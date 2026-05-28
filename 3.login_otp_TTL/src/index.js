import Redis from "ioredis";
import express from "express";

const app = express();
app.use(express.json());
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

function otpKey(phone) {
    return `otp:${phone}`;
}   

app.post("/otp", async (req, res) => { 
    const { phone } = req.body;
    const otp = Math.floor(1000 + Math.random() * 9000); //ye ek random 4 digit ka otp generate kar raha hai
    await redis.set(otpKey(phone), otp, 'EX', 120); //redis me otp ko store kar raha hai, jisme key hogi otp:phone aur value hogi otp, aur usko expire hone ka time set kar raha hai 120 seconds ke baad
    res.json({ message: "OTP sent successfully", otp }); 
});


// cross check karne ke liye ki jo otp client se aaya hai wo redis me store otp ke barabar hai ya nahi

app.post("/otp/verify",async(req,res)=>{
    const {phone,otp} = req.body;
    const storedOtp = await redis.get(otpKey(phone)); //redis se otp ko get kar ke ek variable me store kar lete hai

    if(!storedOtp){
        return res.json({message:"otp has expired or not found"});

    }
    if(storedOtp  !== otp){
        return res.json({message:"Invalid OTP"});

    }
    await redis.del(otpKey(phone)); //last case >agar otp verify ho gaya hai toh usko redis se delete kar dega, taki wo dobara use na ho sake
});



app.get("/otp/:phone/ttl", async (req, res) => {
    const { phone } = req.params;
    const ttl = await redis.ttl(otpKey(phone)); //redis me check kar raha hai ki otp:phone key ka TTL kitna hai, agar key exist karti hai toh uska TTL return karega, agar key exist nahi karti hai toh -2 return karega, agar key exist karti hai lekin uska TTL set nahi hai toh -1 return karega
    res.json({ ttl });
});
//metaadata kya he > > OTP ka TTL kitna hai, OTP kab expire hoga, OTP valid hai ya nahi, etc..

app.listen(3000,()=>{
    console.log("Server is running on port 3000");
});

 