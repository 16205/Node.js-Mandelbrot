const cluster = require('cluster');
// const numCPUs = require('os').cpus().length;
const numCPUs = 2;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });

    require('./master.js')

} else {
    console.log(`Worker ${process.pid} started`);
    require('./worker.js')
}