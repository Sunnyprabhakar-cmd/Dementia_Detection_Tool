import jwt from "jsonwebtoken";

export const authMiddleware=(req,res,next)=>{
    try{
        const authHeader=req.headers.authorization;

        if(!authHeader){
            return res.status(401).json({
                message:"Authentication token required"
            });
        }

        const token =authHeader.split(" ")[1];

        if(!token){
            return res.status(401).json({
                message:"Invalid authentication format"
            });
        }

        const decode=jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user=decode;

    next();

}catch(error){
    return res.status(401).json({
        message:"Invalid or expired token"
    });
}
};

export const requireRole = (...allowedRoles) => (req, res, next) => {
    const role = req.user?.role || "patient";
    if (!allowedRoles.includes(role)) {
        return res.status(403).json({
            message: "Access denied for your account role"
        });
    }
    return next();
};