//Importing node packages
import express from 'express';

//importing controllers 
import {userLogin,userRegistration} from '../controller/authController.js';

//initilizing router
const router=express.Router();

//forwarding request to controller
router.post("/login",userLogin);
router.post("/register",userRegistration);

//exporting router
export default router;