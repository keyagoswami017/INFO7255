const amqp = require('amqplib');

const QUEUE_NAME = 'plan_events';
const RABBITMQ_URL = 'amqp://rabbitmq';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const startConsumer = async () => {
    let attempt = 1;

    while (attempt <= MAX_RETRIES) {
        try {
            console.log(`🔁 Attempt ${attempt} to connect to RabbitMQ...`);

            const connection = await amqp.connect(RABBITMQ_URL);
            const channel = await connection.createChannel();

            await channel.assertQueue(QUEUE_NAME, { durable: true });

            console.log(`🎧 Connected and listening to "${QUEUE_NAME}"`);

            channel.consume(QUEUE_NAME, async (msg) => {
                if (msg !== null) {
                    try {
                        const messageContent = JSON.parse(msg.content.toString());
                        console.log('📥 Received:', messageContent);

                        switch (messageContent.event) {
                            case 'PLAN_CREATED':
                                console.log(`📌 PLAN_CREATED: ${messageContent.objectId}`);
                                break;
                            case 'PLAN_UPDATED':
                                console.log(`✏️ PLAN_UPDATED: ${messageContent.objectId}`);
                                break;
                            case 'PLAN_DELETED':
                                console.log(`🗑️ PLAN_DELETED: ${messageContent.objectId}`);
                                break;
                            default:
                                console.warn('⚠️ Unknown event type:', messageContent.event);
                        }

                        channel.ack(msg);
                    } catch (err) {
                        console.error('❌ Error processing message:', err);
                        channel.nack(msg);
                    }
                }
            });

            break; // success!
        } catch (error) {
            console.error(`❌ RabbitMQ connect failed (attempt ${attempt}):`, error.message);
            attempt++;
            await wait(RETRY_DELAY_MS);
        }
    }

    if (attempt > MAX_RETRIES) {
        console.error('❌ Could not connect to RabbitMQ after max retries. Exiting.');
        process.exit(1);
    }
};

startConsumer();