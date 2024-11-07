const express = require("express");
const app = express();
const AWS = require("aws-sdk");
const multer = require("multer");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRECT_KEY);
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

app.use(cors());
app.use(express.json());
const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  try {
    await client.connect();
    const usersCollection = client.db("graphics-ground").collection("users");
    const logosCollection = client.db("graphics-ground").collection("logos");
    const fileCollection = client.db("graphics-ground").collection("files");
    const paymentCollection = client
      .db("graphics-ground")
      .collection("payments");
    const caseStudiesCollection = client
      .db("graphics-ground")
      .collection("case-studies");
    const packageCollection = client
      .db("graphics-ground")
      .collection("package");
    // DigitalOcean Spaces setup
    const spacesEndpoint = new AWS.Endpoint("nyc3.digitaloceanspaces.com");
    const s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_ACCESS_KEY,
      secretAccessKey: process.env.DO_SECRET_KEY,
    });
    const storage = multer.memoryStorage();
    const upload = multer({ storage: storage });
    //generate custom id
    const generateCustomId = async () => {
      const randomNumber = Math.floor(10000 + Math.random() * 90000);
      const customId = `gg${randomNumber}`;
      const existingEntry = await fileCollection.findOne({ _id: customId });
      return existingEntry ? generateCustomId() : customId;
    };

    app.post("/api/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post(
      "/upload",
      upload.fields([{ name: "images" }, { name: "zipFile" }]),
      async (req, res) => {
        const { title, price, tag, category, description } = req.body;
        const images = req.files["images"];
        const zipFile = req.files["zipFile"][0];

        if (!images || images.length === 0) {
          return res.status(400).json({ message: "No images uploaded." });
        }

        try {
          const imageUploadPromises = images.map((image) => {
            return imagekit.upload({
              file: image.buffer.toString("base64"),
              fileName: `images/${Date.now()}-${image.originalname}`,
              folder: "/graphics-ground/images",
            });
          });

          const imageUploads = await Promise.all(imageUploadPromises);

          // If you still need to handle zip files with DigitalOcean, keep the logic below
          const zipParams = {
            Bucket: "graphics-ground-llc",
            Key: `zips/${Date.now()}-${zipFile.originalname}`,
            Body: zipFile.buffer,
            ACL: "public-read",
          };
          const zipUpload = await s3.upload(zipParams).promise();

          const customId = await generateCustomId();
          const newEntry = {
            _id: customId,
            title,
            price,
            tag,
            category,
            description,
            imageUrls: imageUploads.map((upload) => upload.url),
            zipUrl: zipUpload.Location,
          };
          await logosCollection.insertOne(newEntry);
          res
            .status(200)
            .json({ message: "Upload successful", data: newEntry });
        } catch (error) {
          console.error(error);
          res.status(500).json({ message: "Error uploading files", error });
        }
      }
    );

    app.patch("/api/logos/:id", async (req, res) => {
      const productId = req.params.id;
      const { status } = req.body; // Status message from the frontend

      try {
        const result = await logosCollection.updateOne(
          { _id: productId },
          { $set: { status: status } } // Set the new status
        );

        if (result.modifiedCount > 0) {
          res
            .status(200)
            .json({ message: "Product status updated successfully." });
        } else {
          res.status(404).json({ message: "Product not found." });
        }
      } catch (error) {
        console.error("Error updating product status:", error);
        res.status(500).json({ message: "Failed to update product status." });
      }
    });

    app.get(
      "/api/users/admin/:email",
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
    app.get("/api/users/:role", async (req, res) => {
      try {
        // Fetch users where the 'role' field exists and is not empty
        const usersWithRole = await usersCollection
          .find({ role: { $exists: true, $ne: "" } })
          .toArray();
        res.status(200).json(usersWithRole);
      } catch (error) {
        console.error("Error fetching users with a role:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/api/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/api/users/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email: email });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.send(user);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/api/users", async (req, res) => {
      const user = req.body;

      // Check if a user with this email already exists
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.status(409).send({ message: "User already exists" });
      }

      const lastUser = await usersCollection
        .find({ _id: { $regex: /^gg-/ } })
        .sort({ _id: -1 })
        .limit(1)
        .toArray();

      let newCustomId;
      if (lastUser.length > 0 && typeof lastUser[0]._id === "string") {
        const lastIdNumber = parseInt(lastUser[0]._id.split("-")[1], 10);
        newCustomId = `gg-${lastIdNumber + 1}`;
      } else {
        newCustomId = "gg-1001";
      }

      user._id = newCustomId;

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.delete("/api/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    app.patch(
      "/api/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: id };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.delete("/api/logos/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await logosCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/api/logos", async (req, res) => {
      const result = await logosCollection.find().toArray();
      res.send(result);
    });
    app.get("/api/package", async (req, res) => {
      const result = await packageCollection.find().toArray();
      res.send(result);
    });
    app.get("/api/case-studies", async (req, res) => {
      const result = await caseStudiesCollection.find().toArray();
      res.send(result);
    });
    app.post("/api/create-payment-intent", async (req, res) => {
      try {
        const { price } = req.body;
        if (!price) {
          return res.status(400).send({ error: "Price is required" });
        }
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
      } catch (error) {
        console.error("Error creating payment intent:", error.message);
        res.status(500).send({ error: "Payment intent creation failed" });
      }
    });
    app.post("/api/payments", async (req, res) => {
      const payment = req.body;

      // Fetch the last payment to determine the new custom _id
      const lastPayment = await paymentCollection
        .find({ _id: { $regex: /^gg-/ } })
        .sort({ _id: -1 })
        .limit(1)
        .toArray();

      // Determine the new custom _id
      let newCustomId;
      if (lastPayment.length > 0 && typeof lastPayment[0]._id === "string") {
        const lastIdNumber = parseInt(lastPayment[0]._id.split("-")[1], 10);
        newCustomId = `gg-${lastIdNumber + 1}`;
      } else {
        newCustomId = "gg-1001";
      }

      // Create the payment object
      const paymentData = {
        _id: newCustomId,
        email: payment.email,
        purchased: payment.purchased, // Use the purchased array directly from the client
        transactionId: payment.transactionId,
        // price: payment.price,
        ourCountry: payment.ourCountry,
        // utcDate: payment.utcDate,
        // status: payment.status,
      };

      // Check if the payment document already exists for the user
      const existingPayment = await paymentCollection.findOne({
        email: payment.email,
      });

      if (existingPayment) {
        // If it exists, update the existing document by pushing new purchased item
        await paymentCollection.updateOne(
          { email: payment.email },
          { $push: { purchased: payment.purchased[0] } } // Use the first item from the purchased array
        );
        res.send({ message: "Purchased item added to existing payment." });
      } else {
        // If it doesn't exist, insert the new payment document
        const paymentResult = await paymentCollection.insertOne(paymentData);
        console.log("payment info", paymentData);
        res.send(paymentResult);
      }
    });

    app.get("/api/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(5000, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
