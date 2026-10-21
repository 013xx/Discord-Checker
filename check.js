const DISCORD_ENDPOINT="https://discord.com/api/v9/unique-username/username-attempt-unauthed";
const USERNAME_REGEX=/^[a-z0-9._]+$/;

export default async function handler(req,res){
    if(req.method!=="POST")return res.status(405).json({status:"error",error:"METHOD_NOT_ALLOWED"});
    try{
        const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
        const username=typeof body?.username==="string"?body.username.trim().toLowerCase():"";

        if(!username)return res.status(400).json({status:"invalid",verified:false,error:"USERNAME_REQUIRED"});
        if(username.length<2||username.length>32)return res.status(400).json({status:"invalid",verified:true,error:"INVALID_LENGTH"});
        if(!USERNAME_REGEX.test(username))return res.status(400).json({status:"invalid",verified:true,error:"INVALID_CHARACTERS"});
        if(username.startsWith(".")||username.endsWith(".")||username.includes(".."))return res.status(400).json({status:"invalid",verified:true,error:"INVALID_PERIODS"});

        const discordResponse=await fetch(DISCORD_ENDPOINT,{
            method:"POST",
            headers:{
                "Content-Type":"application/json",
                "Accept":"application/json",
                "User-Agent":"Mozilla/5.0 DiscordUsernameChecker"
            },
            body:JSON.stringify({username})
        });

        if(discordResponse.status===429){
            const retryAfter=discordResponse.headers.get("retry-after");
            return res.status(429).json({status:"rate_limited",verified:false,retryAfter:retryAfter?Number(retryAfter):null});
        }

        if(discordResponse.status===400||discordResponse.status===422){
            let discordData=null;try{discordData=await discordResponse.json()}catch{}
            return res.status(400).json({status:"invalid",verified:true,username,discord:discordData});
        }

        if(discordResponse.status===401||discordResponse.status===403)
            return res.status(discordResponse.status).json({status:"blocked",verified:false,username});

        if(discordResponse.status>=500)
            return res.status(502).json({status:"unknown",verified:false,username,discordStatus:discordResponse.status});

        let data;
        try{data=await discordResponse.json()}catch{
            return res.status(502).json({status:"unknown",verified:false,username,discordStatus:discordResponse.status});
        }

        if(discordResponse.ok&&typeof data.taken==="boolean"){
            return res.status(200).json({
                status:data.taken?"taken":"available",
                taken:data.taken,
                verified:true,
                username
            });
        }

        return res.status(502).json({status:"unknown",verified:false,username,discordStatus:discordResponse.status});
    }catch(error){
        console.error("Discord checker error:",error);
        return res.status(500).json({status:"unknown",verified:false,error:"DISCORD_REQUEST_FAILED"});
    }
}