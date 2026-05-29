// here in api.js >> producers KA IILLAKA
// here we will add jobs to the queue that we created in the queue.js file. We will use the same connection to Redis that we used in the queue.js file.
//  We will also use the same queue that we created in the queue.js file to add jobs.

import express from "express";
const {emailQueue} = require("./queue");

const app = express();
app.use(express.json());    
 

app.post("/send-email",(req,res)=>{
    const {to,subject,body} = req.body;
    emailQueue.add("send-email",
        {to,subject,body} ,              // here we are adding a job(data) to the emailQueue with the name "send-email" and the data that we want to process in the worker. In this case, we are sending an email, so we are passing the recipient's email address, the subject of the email, and the body of the email as data to the job
        
        {attempts:3, backoff:{type:"exponential",delay:5000}}
    
    );  
    res.json({message:"Email sent!",jobid:job.id});
});

// that attempts : 3 means that if the job fails, it will be retried 3 times before it is marked as failed. The backoff option is used to specify the delay between retries. In this case, we are using an
//  exponential backoff strategy, which means that the delay will increase exponentially with each retry. The first retry will be after 5 seconds, the second retry will be after 10 seconds, and the third retry will be after 20 seconds. This helps to prevent overwhelming the system with too many retries in a short period of time.


app.listen(3000,()=>{   
    console.log("Server is running on port 3000");
}); 

    