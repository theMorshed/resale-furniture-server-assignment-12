const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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

        // get a jwt a token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ token });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.get('/user/role/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ role: user?.role });
        });

        // this is not using still now
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = {email};
            const result = await usersCollection.findOne(query);
            res.send(result);
        });

        app.post('/addfurniture', async (req, res) => {
            const furniture = req.body;
            const result = await furnitureCollection.insertOne(furniture);
            res.send(result);
        });

        app.delete('/deletefurniture/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await furnitureCollection.deleteOne(filter);
            res.send(result);
        });

        app.put('/verifySeller/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)};
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    isVerified: true
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) };
        //     const result = await doctorsCollection.deleteOne(filter);
        //     res.send(result);
        // })

        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category: id };
            const result = await furnitureCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/sellerproducts/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const result = await furnitureCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/allsellers', async (req, res) => {
            const query = { role: 'seller' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });

        app.delete('/deleteSeller/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        app.delete('/deleteBuyer/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        // temporary to update price field on appointment options
        // app.get('/addStatus', async (req, res) => {
        //     const filter = {}
        //     const options = { upsert: true }
        //     const updatedDoc = {
        //         $set: {
        //             status: 'available'
        //         }
        //     }
        //     const result = await furnitureCollection.updateMany(filter, updatedDoc, options);
        //     res.send(result);
        // })

        app.get('/allbuyers', async (req, res) => {
            const query = { role: 'buyer' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/orders', verifyJWT, async (req, res) => {
            const decoded = req.decoded;
            if (decoded.email !== req.params.email) {
                res.status(403).send({ message: 'unauthorized access' })
            }

            const product = req.body;
            const result = await ordersCollection.insertOne(product);
            res.send(result);
        });

        app.delete('/deleteOrder/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        });

        app.get('/dashboard/orders/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const result = await ordersCollection.find(query).toArray();
            res.send(result);
        });

    }
    finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('All resale services here.');
});

app.listen(port, () => {
    console.log('Resale server running successfully.');
})