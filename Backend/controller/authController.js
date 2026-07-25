import {Login,Register} from '../services/authService.js';

//User Login controller logic
export const userLogin= async(req,res)=>{
    try{
        const {email,password}=req.body;

        if(!email || !password){
            return res.status(400).json({
                message:"Email and password are required"
            });
        }
        const result=await Login(email,password);
        return res.status(200).json(result);

    }catch(err){
        return res.status(401).json({
            message:err.message
        });
    }
};

//user registration controller logic
export const userRegistration=async(req,res)=>{
    try{
        const {name,email,password,referBy}=req.body;

        if(!name || !email || !password){

            return res.status(400).json({
                message:"Name, Email and password are must"
            })
        }

        const result=await Register(name,email,password,referBy);
        return res.status(200).json(result);
    }catch(error){
        return res.status(500).json({
            message:error.message,
        });
    }
}