// const express = require("express");
// const app = express();
// const cors = require("cors");
// require("dotenv").config();
// const port = process.env.PROT || 5000;
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const stripe = require("stripe")(process.env.STRIPE_SECRECT_KEY);

// //middleware
// app.use(cors());
// app.use(express.json());
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h86awbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// // Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
// });

// async function run() {
//   try {
//     await client.connect(); // Connect the client to the server	(optional starting in v4.7)
//     const usersCollection = client.db("graphicGroundDB").collection("users");
//     const logosCollection = client.db("graphicGroundDB").collection("logos");
//     const caseStudiesCollection = client
//       .db("graphicGroundDB")
//       .collection("case-studies");
//     const packageCollection = client
//       .db("graphicGroundDB")
//       .collection("package");

//     //USERS COLLECTION OPERATION
//     app.post("/users", async (req, res) => {
//       const user = req.body;
//       const query = { eamil: user.email };
//       const result = await usersCollection.insertOne(user);
//       res.send(result);
//     });
//     //GETTING USERS
//     app.get("/users", async (req, res) => {
//       const result = await usersCollection.find().toArray();
//       res.send(result);
//     });
//     /// Assuming you have a route to get user details by user ID or email
//     app.get("/users/:email", async (req, res) => {
//       try {
//         const email = req.params.email;
//         const user = await usersCollection("/users").findOne({ email: email });

//         if (!user) {
//           return res.status(404).json({ message: "User not found" });
//         }

//         res.send(user); // Sends user data, including phoneNumber
//       } catch (error) {
//         res.status(500).json({ error: "Internal Server Error" });
//       }
//     });

//     //LOGO COLLECTION  OPERATION
//     app.get("/logos", async (req, res) => {
//       const result = await logosCollection.find().toArray();
//       res.send(result);
//     });

//     app.delete("/logos/:id", async (req, res) => {
//       const id = req.params.id; // Get the id from the request parameters
//       console.log(new ObjectId(id), "this is the fucking id");
//       const query = { _id: new ObjectId(id) }; // Convert string to ObjectId
//       console.log(query, "and this is the fucking query");
//       const result = await logosCollection.deleteOne(query); // Perform the delete operation
//       res.send(result);
//     });

//     // PACKAGE COLLECTION
//     app.get("/package", async (req, res) => {
//       const result = await packageCollection.find().toArray();
//       res.send(result);
//     });

//     // CASE STUDIES COLLECTION
//     app.get("/case-studies", async (req, res) => {
//       const result = await caseStudiesCollection.find().toArray();
//       res.send(result);
//     });

//     // PAYMENT METHOD OPARETION $
//     app.post("/create-payment-intent", async (req, res) => {
//       const { price } = req.body;
//       const priceis = Number(price);
//       const amount = parseInt(priceis * 100);
//       console.log(amount, "amount inside the intent");

//       const paymentIntent = await stripe.paymentIntents.create({
//         amount: amount,
//         currency: "usd",
//         payment_method_types: ["card"],
//       });

//       res.send({
//         clientSecret: paymentIntent.client_secret,
//       });
//     });

//     await client.db("admin").command({ ping: 1 }); // Send a ping to confirm a successful connection
//     console.log(
//       "Pinged your deployment. You successfully connected to MongoDB!"
//     );
//   } finally {
//     // Ensures that the client will close when you finish/error
//     // await client.close();
//   }
// }
// run().catch(console.dir);

// app.get("/", (req, res) => {
//   res.send("server is running");
// });

// app.listen(port, () => {
//   console.log(`server is running on port ${port}`);
// });
