// this file is responsible for creating a queue and connecting it to the Redis server. We will use this queue to add jobs that will be processed by the worker.




import {Queue} from "bullmq";


//now firslt conncet conncet redis sercer to bullmq > You're telling BullMQ:"If you need Redis,connect to this Redis server."


const connection ={
    host: "localhost",
    port: 6379

};

// now create a queue and pass the connection to it
// abb kitne bhi queue banao no prob emial,otp, ratelimiting annd saanndd kuc bhi 



const emailQueue = new Queue("emails",{connection});

module.exports = {emailQueue,connection};


