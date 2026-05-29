// this is worker.js here basically CONSUMERS KA IILLAKA 
// here we will process the jobs that are added to the queue. We will use the same connection to Redis that we used in the queue.js file. We will also use the same queue that we created in the queue.js file to process the jobs.




import {Worker} from "bullmq";
const {emailQueue,connection} = require("./queue");

const worker = new Worker(
    "emails",
    async (job)=>{
        console.log("Processing job:",job.id,job.data);
        (await new Promise((resolve)=>setTimeout(resolve,2000))); //here we are simulating a delay of 2 seconds to process the job. In real life, this is where you would put your actual job processing logic, like sending an email or doing some database operations.
        console.log("Job completed:",job.id);

    },
    {connection}
);

worker.on("completed",(job)=>{
    console.log("Job completed event received for job:",job.id);
});

worker.on("failed",(job,err)=>{
    console.log("Job failed event received for job:",job.id,"with error:",err);
});

