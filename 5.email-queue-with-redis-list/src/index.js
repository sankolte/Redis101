import express from 'express';
import Redis from 'ioredis';


const app = express();

app.use(express.json()); //like jo data client se aayega usko json format me convert kar dega   

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379'); //redis client ko initialize kar raha hai, jo ki environment variable se url lega, agar wo nahi mila toh default me localhost ke 6379 port pe connect karne ki koshish karega here ye url is docker ke andar ke redis server ka url hoga

const EMAIL_QUEUE_KEY = "email_queue"; //ye ek constant hai jisme humne email queue ke liye ek key define ki hai, jisko hum redis me store karenge , agar ekk se jyadabho keys to ekk object me rakh lo like ek banner ki ekk otp ki ekk rate limiting ki etc..

app.post("/send-email", async (req, res) => {  //ye ek endpoint hai jisme client se email data aayega aur usko redis me store karenge

    const { to, subject, body } = req.body; //jo bhi data client se aayega usko json format me convert kar ke redis me store kar dega, jisme key hogi EMAIL_QUEUE_KEY aur value hogi client se aaya hua data    
    const job = { to, subject, body }; //email job ke liye ek object bana lete hai jisme email ka data store karenge
    await redis.rpush(EMAIL_QUEUE_KEY, JSON.stringify(job)); //jo bhi email job ka data aayega usko json format me convert kar ke redis me store kar dega, jisme key hogi EMAIL_QUEUE_KEY aur value hogi client se aaya hua data

    res.json({ message: "Email job added to queue" }); //client ko ye message bhej dega ki email job queue me add ho gaya hai   
});

app.get("/process-email", async (req, res) => {  
    const rawdata = await redis.lpop(EMAIL_QUEUE_KEY); 
    if (!rawdata) { 
        return res.json({ message: "No email jobs in queue" }); 
    }
    const job = JSON.parse(rawdata); 
    res.json({ message: "Processing email job", job });
    //yaha pe email job ko process karne ka code aayega, jaise ki email bhejna etc. lekin yaha pe hum sirf job ko fetch kar ke client ko bhej rahe hai, taki hum dekh sake ki job sahi se fetch ho raha hai ya nahi
});



//--------------------------------------------------------------------------------------







app.listen(3000, () => { 
    console.log("Server is running on port 3000");
});
    
