import Redis from 'ioredis';
import express from "express";

const app = express();

app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');


app.post("/leaderboard/score",async (req,res)=>{
    let {userId,score}=req.body;
    if(userId == null || score == null){
        return res.status(400).json({error:"userId and score are required"});   
    }
    await redis.zincrby("leaderboard",score,userId);
    res.json({msg:"score of user is updated succesfually"});

})

app.get("/leaderboard/top",async (req,res)=>{
     let leaders =await redis.zrevrange("leaderboard",0,9,"WITHSCORES");    // WITHSCORES is used to get the score along with the userId
    //  if(!leaders){
    //     return res.status(400).json({"error":"no leaders found"});
    //  }    this check if cool but this thif is arevrange return a arry so hume wise check karna padeg alike leaders.legth==0 like this 
    if(leaders.length==0){
        return res.status(400).json({"error":"no leaders found"});
     }
     res.json({"Leaders":leaders});

})


app.get("/leaderboard/:userId/rank",async(req,res)=>{
    let {userId}=req.params;
    let rank = await redis.zrevrank("leaderboard",userId);
    // if(!rank){
    //     return res.status(400).json({"error":"usernot found in leaderboard"});
    // }
    if(rank === null){
    return res.status(400).json({
        error:"user not found in leaderboard"
    });
}
    console.log(rank+1);
    res.json({"userId":userId,"rank":rank+1});   // rank is 0 based index so we add 1 to get the actual rank

})

// one more endpoint to get the score of a user

app.get("/leaderboard/:userId/score",async(req,res)=>{
     let {userId}=req.params;
     let score = await redis.zscore("leaderboard",userId);
     if(score==null){
        return res.status(400).json({"error":"user not found in leaderboard"});
     }
     res.json({"userId":userId,"score":score});
})


app.listen(3000,()=>{
    console.log("server is running on port 3000");

});



// mistake i did and then i made them correct >>

// Bug #1: zrevrank() check is wrong

// You wrote:

// let rank = await redis.zrevrank("leaderboard",userId);

// if(!rank){
//     return res.status(400).json({
//         error:"usernot found in leaderboard"
//     });
// }

// Suppose the user is rank #1.

// Redis returns:

// rank = 0

// because ranks are 0-based.

// Then:

// !0

// is

// true

// So you'll incorrectly return:

// {
//   "error": "usernot found in leaderboard"
// }

// fix :
// if(rank === null){
//     return res.status(400).json({
//         error:"user not found in leaderboard"
//     });
// }

// similarly in other  routes also >> emphasize in null check rather than falsy check because 0 is also falsy but it is a valid value in our case.