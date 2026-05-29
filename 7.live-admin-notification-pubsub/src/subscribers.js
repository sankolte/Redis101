// pub sub me jo sunte he usko subscriber kehte he
// here we are subscribing to the certain event > matlab wo event ke hone par humko notification milega


import Redis from "ioredis";

const subscriber = new Redis(process.env.REDIS_URL||"redis://localhost:6379"); // create a new Redis client for subscribing

// abb subscriber subscribe karega

subscriber.subscribe("notification", (err) => {
    if(err){
       
        console.log("Error subscribing to notification channel", err); 
        return
    } else {
        console.log("Subscribed to notification channel successfully");
    }
});

// jab bhi notification channel par koi message publish hoga to ye callback function execute hoga\

subscriber.on("message", (channel, message) => {
    console.log(`Received message from channel ${channel}: ${message}`);
    // yahan par hum apne notification ko process kar sakte hain, jaise ki user ko notify karna, database me store karna, etc.
}); 
// basically message ko receive karne ke baad hum usko process kar sakte hain,(bascially sub jo he worker wo kya karega message milte ke baad suppose mast frotedn laga ke render kar liya aisa..) jaise ki user ko notify karna, database me store karna, etc.

