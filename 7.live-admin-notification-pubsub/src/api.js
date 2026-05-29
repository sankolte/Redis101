// iddhar hum publisher banayege >> jo kaam dega like apne normal api routes > post req ya aissa hi 

import express from "express";
import Redis from "ioredis";

const app = express();
const publisher = new Redis(process.env.REDIS_URL||"redis://localhost:6379"); // create a new Redis client for publishing

app.use(express.json()); // for parsing application/json


//dekho hum yaha se abhi ekk post route banayege jaha pe >> see hum uss" notifications " jo banaya na humne channel> in ssubsciber abhi uss channel pe send kareg ahum kuch payload like notification ka data
// pehele payload nikalo
 // and then ye payload publish kar do matlab send kar do channel ko > buss chaneel ka naam achese likhna >>EASY
//  by using publisher.publish() method

app.post("/send-notification", async(req, res) => {
    const payload= { message: req.body.message,
                    createdAT:new Date().toISOString()
     }; // assuming the payload is sent in the request body as { "message": "your notification message" }

     const sendresults = await publisher.publish("notifications",JSON.stringify(payload));
     res.send("chala gaya notifications channels pe aamd now wo chnannel and wo sab hoga in sub wlaa  ")
});
    
    
  






app.listen(3000,()=>{
    console.log("server is running on port 3000");      
});
