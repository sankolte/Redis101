import express from 'express';
import Redis from 'ioredis';



const app = express();

app.use(express.json()); //like jo data client se aayega usko json format me convert kar dega

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379'); //redis client ko initialize kar raha hai, jo ki environment variable se url lega, agar wo nahi mila toh default me localhost ke 6379 port pe connect karne ki koshish karega here ye url is docker ke andar ke redis server ka url hoga
 
const BANNER_KEY = "app_banner"; //ye ek constant hai jisme humne site banner ke liye ek key define ki hai, jisko hum redis me store karenge , agar ekk se jyadabho keys to ekk object me rakh lo like ek banner ki ekk otp ki ekk rate limiting ki etc..


app.post("/banner", async (req, res) => {  //ye ek endpoint hai jisme client se banner data aayega aur usko redis me store karenge

    await redis.set(BANNER_KEY, req.body.message || "welcome to our website"); //jo bhi data client se aayega usko json format me convert kar ke redis me store kar dega, jisme key hogi BANNER_KEY aur value hogi client se aaya hua data

    res.json({ message: "Banner updated successfully" }); //client ko ye message bhej dega ki banner update ho gaya hai

});


app.get("/banner", async (req, res) => {  //ye ek endpoint hai jisme client banner data ko get karne ke liye request karega aur usko redis se fetch kar ke client ko bhej dega

    const message = await redis.get(BANNER_KEY); //redis se banner data ko get kar ke ek variable me store kar lete hai
    if(message){
        res.json({ message }); //agar banner data mil gaya toh client ko usko json format me bhej dega
    }   
    else{
        res.json({ message: "No banner set" }); //agar banner data nahi mila toh client ko ye message bhej dega
    }   

//hi mazhi gandmasti ahe ok if else chi u can do anyhting here

});

// hpw to delete the banner from redis

app.delete("/banner", async (req, res) => { 
    await redis.del(BANNER_KEY); 
    res.json({ message: "Banner deleted successfully" });
});


app.get("/banner/exists",async (req, res) => {
    const exists = await redis.exists(BANNER_KEY); //redis me check kar raha hai ki BANNER_KEY exist karta hai ya nahi, agar karta hai toh 1 return karega, nahi karta hai toh 0 return karega   
    res.json({ exists: Boolean(exists) }); //jo bhi exists ka value aayega usko boolean me convert kar ke client ko bhej dega, agar exists 1 hai toh true hoga, agar exists 0 hai toh false hoga
});





app.listen(3000,()=>{ 
    console.log("Server is running on port 3000");
});
