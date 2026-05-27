import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';

const app = express();


const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
// basically wo redis server ke url ko le raha hai environment variable se, agar wo nahi mila toh default me localhost ke 6379 port pe connect karne ki koshish karega here ye url is docker ke andar ke redis server ka url hoga


// redis se baat karna hua to >> usko ping karne ka ekk bata lete he 


app.get("/redis", async (req, res) => {
    const reply = await redis.ping();   //method hai ping, jo redis server ko ping karta hai aur uska response return karta hai
    res.json({ redis: reply });  //jo bhi reply aayega usko client ko bhej dega
});


// easy 

// now we will connect to mongodb database using mongoose

app.get("/mongoose", async (req, res) => {
    const url= process.env.MONGODB_URL || 'mongodb://localhost:27017/mydb';  //mongodb server ke url ko environment variable se le raha hai, agar wo nahi mila toh default me localhost ke 27017 port pe connect karne ki koshish karega here ye url is docker ke andar ke mongodb server ka url hoga
    if(mongoose.connection.readyState === 0){  //agar mongoose connection ready state 0 hai to matlab ki wo abhi tak connect nahi hua hai 
        await mongoose.connect(url);  //toh usko connect karne ki koshish karega
    }
    res.json({ mongoose: "Connected to MongoDB" , database:mongoose.connection.name});  //agar connect ho gaya toh client ko ye message bhej dega
});




app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

