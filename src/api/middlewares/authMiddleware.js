const { OAuth2Client, auth } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error : true ,message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try{
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID 
        });

        const payload = ticket.getPayload();
        req.user = payload;
        next();
    }
    catch (error) {
        console.error('Error verifying Google token:', error);
        console.error(error);
        return res.status(401).json({ error: true, message: 'Invalid token' });
    }


};

module.exports =  verifyGoogleToken;