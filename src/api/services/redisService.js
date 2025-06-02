const { redisClient } = require('./redisClient');

//Post
const setData = async (key, value) => {
    await redisClient.set(key, JSON.stringify(value));
};

// Get
const getData = async (key) => {
    const raw = await redisClient.get(key);
    if (typeof raw !== 'string') {
        console.warn('Unexpected non-string value from Redis:', raw);
        return raw;
    }

    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error('Invalid JSON from Redis:', raw);
        throw err;
    }
};

// Delete
const deleteData = async (key) => {
    return await redisClient.del(key);
};

module.exports = { 
    setData,
    getData,
    deleteData
 };