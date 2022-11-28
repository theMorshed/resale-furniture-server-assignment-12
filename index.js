const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

// custom middleware for jwt token verification
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    })
}


// mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zkjorm4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const furnitureCollection = client.db('resaleFurnitures').collection('furnitures');
        const usersCollection = client.db('resaleFurnitures').collection('users');
        const ordersCollection = client.db('resaleFurnitures').collection('ordres');
        const reportsCollection = client.db('resaleFurnitures').collection('reports');
        const paymentsCollection = client.db('resaleFurnitures').collection('payments');

        // get a jwt a token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ token });
        });

        // stripe create payment intent api
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // stripe payments api
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: 'paid',
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await furnitureCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        // update furniture status after sale api
        app.put('/updateFurnitureStatus/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    status: 'sold'
                }
            }
            const result = await furnitureCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // update order status after payment
        app.put('/updateOrderStatus/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    status: 'paid'
                }
            }
            const result = await ordersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // get a single furniture with id
        app.get('/furniture/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await furnitureCollection.findOne(query);
            res.send(result);
        });

        // get a single order
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.findOne(query);
            res.send(result);
        })

        // save user into mongodb
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // user report furniture by this api
        app.post('/reportFurniture', async (req, res) => {
            const furniture = req.body;
            const result = await reportsCollection.insertOne(furniture);
            res.send(result);
        });

        // get all reported furniture
        app.get('/reportedFurniture', async (req, res) => {
            const query = {};
            const result = await reportsCollection.find(query).toArray();
            res.send(result);
        });

        // delete reported furniture by admin from mongodb
        app.delete('/deleteReported/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await furnitureCollection.deleteOne(filter);
            res.send(result);
        });

        // delete reporte furniture from ui of admin
        app.delete('/deleteReportedFromReports/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { product_id: id };
            const result = await reportsCollection.deleteOne(filter);
            res.send(result);
        });

        // get user role for verification
        app.get('/userRole/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send(user);
        });

        // add a furniture
        app.post('/addfurniture', async (req, res) => {
            const furniture = req.body;
            const result = await furnitureCollection.insertOne(furniture);
            res.send(result);
        });

        // delete a specific furniture
        app.delete('/deletefurniture/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await furnitureCollection.deleteOne(filter);
            res.send(result);
        });

        // delete seller furniture when seller is deleted by admin
        app.delete('/deleteSellerFurniture/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await furnitureCollection.deleteMany(filter);
            res.send(result);
        });

        // verify seller by admin
        app.put('/verifySeller/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    isVerified: true
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // verify seller by in furniture collection
        app.put('/verifySellerInFurniture/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    verifiedSeller: true
                }
            }
            const result = await furnitureCollection.updateMany(filter, updatedDoc, options);
            res.send(result);
        });

        // seller advertise furniture by this api
        app.put('/advertisefurniture/:id', verifyJWT, async (req, res) => {
            const decoded = req.decoded;
            if (decoded.email !== req.params.email) {
                res.status(403).send({ message: 'unauthorized access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    advertised: true
                }
            }
            const result = await furnitureCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // get all categorized furniture for display
        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category: id };
            const result = await furnitureCollection.find(query).toArray();
            res.send(result);
        });

        // get all furniture of a specific seller
        app.get('/sellerproducts/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const result = await furnitureCollection.find(query).toArray();
            res.send(result);
        });

        // get all advertised furniture to display
        app.get('/advertisedFurniture', async (req, res) => {
            const query = { advertised: true };
            const result = await furnitureCollection.find(query).toArray();
            res.send(result);
        });

        // get all sellers for admin display
        app.get('/allsellers', async (req, res) => {
            const query = { role: 'seller' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });

        // verify seller by admin
        app.get('/verifySeller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const result = await usersCollection.findOne(query);
            res.send(result);
        });

        // delete a seller by admin
        app.delete('/deleteSeller/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        // delete a buyer or user by admin
        app.delete('/deleteBuyer/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        // get all buyers in admin route
        app.get('/allbuyers', verifyJWT, async (req, res) => {
            const decoded = req.decoded;
            if (decoded.email !== req.params.email) {
                res.status(403).send({ message: 'unauthorized access' })
            }

            const query = { role: 'buyer' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });

        // set a order 
        app.post('/orders', verifyJWT, async (req, res) => {
            const decoded = req.decoded;
            if (decoded.email !== req.params.email) {
                res.status(403).send({ message: 'unauthorized access' })
            }

            const product = req.body;
            const result = await ordersCollection.insertOne(product);
            res.send(result);
        });

        // delete an order
        app.delete('/deleteOrder/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        });

        // get all orders of a specific buyer
        app.get('/dashboard/orders/:email', verifyJWT, async (req, res) => {
            const decoded = req.decoded;
            if (decoded.email !== req.params.email) {
                res.status(403).send({ message: 'unauthorized access' })
            }

            const email = req.params.email;
            const query = { email };
            const result = await ordersCollection.find(query).toArray();
            res.send(result);
        });

    }
    finally {

    }
}
run().catch(err => console.error(err));

app.get('/', (req, res) => {
    res.send('Resale furniture server running successfully.');
});

app.listen(port, () => {
    console.log('Resale server running successfully.');
})