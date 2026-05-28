import exrpress from "express";
import Redis from "ioredis";

const app = exrpress();
app.use(exrpress.json());

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// sabse pehele how we do it like sabse simple method 

app.post("/user/:id", async (req, res) => {
    const { id } = req.params;
    const userData = req.body;
    await redis.set(`user:${id}`, JSON.stringify(userData));

    res.json({"saved": true});
}); 

app.get("/user/:id", async (req, res) => {
    const { id } = req.params;
    const userData = await redis.get(`user:${id}`);
    if (!userData) {
        return res.status(404).json({ message: "User not found" });
    }
    res.json(JSON.parse(userData));
}); 

//------------------------------------------------------------

// lekin hum gennrally iss tarhe ka data store nahi karte hai redis me , kyuki jab bhi hume user data ko update karna hota hai toh hume pura data ko overwrite karna padta hai, aur agar data
//  me kuch fields jyada ho jate hai toh wo inefficient ho jata hai, isliye hum redis ke hash data structure ka use karte hai, jisme hum user ke different fields ko alag alag store kar sakte hai, aur 
// jab bhi hume kisi field ko update karna hota hai toh hum sirf us field ko update kar sakte hai, bina baki fields ko touch kiye hue

// basivally abb me data ko string me nahi rakhan chahat > like ab tak string me tha like ab tak user:23,"23" ab me chahat ki user:23 ke andar name,age,city etc.like a OBJECT> alag alag fields me store ho jaye taki jab bhi mujhe kisi field ko update karna ho toh me sirf us field ko update kar saku bina baki fields ko touch kiye hue


app.post("/user/:id/hash", async (req, res) => {
    const { id } = req.params;
    const userData = req.body;
    await redis.hset(`user:${id}`, userData); //hset command ka use kar ke hum user ke different fields ko alag alag store kar sakte hai, jisme key hogi user:id aur value hogi userData ka har ek field

    res.json({ message: "User data stored in Redis hash" });
});


app.get("/user/:id/hash", async (req, res) => {
    const { id } = req.params;
    const userData = await redis.hgetall(`user:${id}`); //hgetall command ka use kar ke hum user ke different fields ko ek object me get kar sakte hai, jisme key hogi user:id aur value hogi userData ka har ek field
    res.json(userData);
});


app.listen(3000, () => {       
    console.log("Server is running on port 3000");
}   
);



//-------------------------------------------------------------
// how is sinngle fields can be be updates code >
app.put("/user/:id/hash", async (req, res) => {
    const { id } = req.params;
    const { field, value } = req.body; //jo bhi field aur value client se aayega usko destructure kar lete hai
    await redis.hset(`user:${id}`, field, value); //hset command ka use kar ke hum user ke specific field ko update kar sakte hai, jisme key hogi user:id aur field hogi jo client se aaya hai aur value hogi jo client se aaya hai

    res.json({ message: "User data updated in Redis hash" });
});

// hget command ka use kar ke hum user ke specific field ko get kar sakte hai, jisme key hogi user:id aur field hogi jo client se aaya hai

