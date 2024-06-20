require('dotenv').config();
const express = require('express')
const app = express()
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 3001
const nodemailer = require('nodemailer');
const crypto = require('crypto');

app.use(cors()) 
app.use(express.json())
 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fgavjwc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'Gmail', // or any other email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate OTP
function generateOTP() {
  return crypto.randomBytes(3).toString('hex'); // 6-digit OTP
}

// Send OTP via email
async function sendOTP(email, otp) {
  const mailOptions = {
    from: {
      name:'Bolggin Site',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`,
  };

  await transporter.sendMail(mailOptions);
}

async function run() {
    try {
      await client.connect();
      const postCollection = client.db('database').collection('post');
      const userCollection = client.db('database').collection('user');
      const otpCollection = client.db('database').collection('otp');
  
      app.get('/post', async (req, res) => {
        const posts = (await postCollection.find().toArray()).reverse();
        res.send(posts);
      });

      app.get('/user', async (req, res) => {
        const user = await userCollection.find().toArray();
        res.send(user);
      });

      app.get('/loggedInUser',async (req,res)=>{
        const email = req.query.email;
        const user = await userCollection.find({email:email}).toArray();
        res.send(user);
      })

      app.get('/userPost',async (req,res)=>{
        const email = req.query.email;
        const post = (await postCollection.find({email:email}).toArray()).reverse();
        res.send(post);
      })
  
      app.post('/post', async (req, res) => {
        const post = req.body;
        const result = await postCollection.insertOne(post);
        res.send(result);
      });

      app.post('/register', async (req, res) => {
        const user = req.body;
        const result = await userCollection.insertOne(user);
        res.send(result);
      });

      app.patch('/updateUser/:email',async(req,res)=>{
        const filter = req.params;
        const profile = req.body;
        const options = {upsert:true}
        const updateDoc = {$set:profile};
        const result = await userCollection.updateOne(filter,updateDoc,options)
        res.send(result);
      })

      app.patch('/updatePostUserProfile/:email',async(req,res)=>{
        const filter = req.params;
        const profilePic = req.body;
        const options = {upsert:true}
        const updateDoc = {$set:profilePic};
        const result = await postCollection.updateMany(filter,updateDoc,options)
        res.send(result);
      })

      app.post('/requestOTP', async (req, res) => {
        const { email } = req.body;
        const otp = generateOTP();
        const timestamp = new Date().getTime();
      
        // Store OTP in the database
        await otpCollection.insertOne({ email, otp, timestamp });
      
        // Send OTP via email
        await sendOTP(email, otp);
      
        res.send({ message: 'OTP sent to your email' });
      });
      
      // Verify OTP endpoint
      app.post('/verifyOTP', async (req, res) => {
        const { email, otp } = req.body;
        const record = await otpCollection.findOne({ email, otp });
      
        if (!record) {
          return res.status(400).send({ message: 'Invalid OTP' });
        }
      
        // Check if OTP is expired (valid for 5 minutes)
        const currentTime = new Date().getTime();
        if (currentTime - record.timestamp > 5 * 60 * 1000) {
          return res.status(400).send({ message: 'OTP expired' });
        }
      
        // OTP is valid, remove it from the database
        await otpCollection.deleteOne({ email, otp });
      
        res.send({ message: 'OTP verified successfully' });
      });
  
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (e) {
      console.error(e);
    }
  }
  run().catch(console.dir);
  


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})