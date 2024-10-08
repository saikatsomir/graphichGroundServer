const express = require("express");
// const mongoose = require("mongoose");
const app = express();
const cors = require("cors");
// const multer = require("multer");
// const { GridFsStorage } = require("multer-gridfs-storage");
// const Grid = require("gridfs-stream");
// const sgMail = require("@sendgrid/mail");
// const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const PORT = process.env.PORT || 3000; // 3000 is the default port for local development
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRECT_KEY);
// Set your SendGrid API Key
// sgMail.setApiKey(process.env.YOUR_SENDGRID_API_KEY);
//middleware
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h86awbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Initialize GridFS stream
// let gfs;
// client.once("open", () => {
//   gfs = Grid(client.db, mongoose.mongo);
//   gfs.collection("uploads");
// });

// Create storage engine for GridFS
// const storage = new GridFsStorage({
//   url: uri,
//   file: (req, file) => {
//     return {
//       bucketName: "uploads", // Collection name
//       filename: `${Date.now()}-${file.originalname}`, // Customize the file name
//     };
//   },
// });
// const upload = multer({ storage });

async function run() {
  try {
    await client.connect(); // Connect the client to the server	(optional starting in v4.7)
    const usersCollection = client.db("graphicGroundDB").collection("users");
    const logosCollection = client.db("graphicGroundDB").collection("logos");
    const paymentCollection = client
      .db("graphicGroundDB")
      .collection("payments");
    const caseStudiesCollection = client
      .db("graphicGroundDB")
      .collection("case-studies");
    const packageCollection = client
      .db("graphicGroundDB")
      .collection("package");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRECT, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log("chodna", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRECT, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get(
      "/users/admin/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;

        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "forbidden access" });
        }

        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      }
    );

    //GETTING USERS
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      console.log(req.headers);
      res.send(result);
    });
    /// Assuming you have a route to get user details by user ID or email
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection("/users").findOne({ email: email });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.send(user); // Sends user data, including phoneNumber
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //USERS COLLECTION OPERATION
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { eamil: user.email };
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //DELETE SPECEFIC USERS
    app.delete("/users/:id", verifyAdmin, verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // //PATCH ADMIN
    // app.patch(
    //   "/users/admin/:id",
    //   // verifyToken,
    //   // verifyAdmin,
    //   async (req, res) => {
    //     const id = req.params.id;
    //     const filter = { _id: new ObjectId(id) };
    //     const updatedDoc = {
    //       $set: {
    //         role: "admin",
    //       },
    //     };
    //     const result = await usersCollection.updateOne(filter, updatedDoc);
    //     res.send(result);
    //   }
    // );

    //DELTE LOGO
    app.delete("/logos/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await logosCollection.deleteOne(query);
      res.send(result);
    });

    // LOGO COLLECTION  OPERATION
    app.get("/logos", async (req, res) => {
      const result = await logosCollection.find().toArray();
      res.send(result);
    });

    // PACKAGE COLLECTION
    app.get("/package", async (req, res) => {
      const result = await packageCollection.find().toArray();
      res.send(result);
    });

    // CASE STUDIES COLLECTION
    app.get("/case-studies", async (req, res) => {
      const result = await caseStudiesCollection.find().toArray();
      res.send(result);
    });

    // PAYMENT METHOD OPARETION $
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const priceis = Number(price);
      const amount = parseInt(priceis * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log("payment info", payment);
      res.send(paymentResult);
    });
    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    //upload zip folder
    // Route to handle ZIP file uploads
    // app.post("/upload", verifyToken, upload.single("file"), (req, res) => {
    //   res.json({ file: req.file });
    // });

    await client.db("admin").command({ ping: 1 }); // Send a ping to confirm a successful connection
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
