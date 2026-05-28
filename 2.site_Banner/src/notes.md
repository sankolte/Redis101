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


# explaination :
i m just codingthis for learning puporse like suppose data comes from banner route through post route suppose koi client udhar se likh ke send kar rah ahe /Banner iss route pe supoose <button><a href="Banner></button>(dont judge my html it for only eg >> but suppose that user fills the fomr and press this button and then we get the data > now we will save it in redis y set function this is one part similarly suppose now i want to give the data like suppose i click someehere and banner apperes similar by get route using get methofd or redis we did it easy

