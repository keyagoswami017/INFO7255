const amqp = require('amqplib');

const QUEUE_NAME = 'plan_events';
const RABBITMQ_URL = 'amqp://rabbitmq';

let channel = null;

const initRabbitMQ = async () => {
    if (channel) return channel;

    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log('✅ RabbitMQ publisher connected');
    } catch (error) {
        console.error('❌ Failed to connect to RabbitMQ:', error.message);
    }

    return channel;
};

const sendToQueue = async (message) => {
    try {
        const ch = await initRabbitMQ();
        ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
            persistent: true
        });
        console.log(`📤 Sent message to queue: ${JSON.stringify(message)}`);
    } catch (error) {
        console.error('❌ Failed to send message to RabbitMQ:', error.message);
    }
};

module.exports = {
    sendToQueue
};