// Set globals
require('events').EventEmitter.defaultMaxListeners = 50;
const path = require('path');
if (process.argv[1].includes('snapshot')) process.argv[1] = process.argv[1].replace('cvmfe.js', path.relative(process.cwd(), process.argv0)); // Workaround that shows the correct file path inside the pkg generated file
require('../lib/util/chainableError').replaceOriginalWithChained();

const yargs = require('yargs');

const packageJSON = require('../package.json');
const CONFIG = require('../lib/util/config');

const createCommandHandler = (func) => {
    return async (argv) => {
        try {
            await func(argv);

            // Wait 5 seconds so promises can complete
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Force exit if there is something holding the event loop
            setTimeout(() => {
                console.log('Forcing process exit after 10m');
                process.exit(0);
            }, 1000 * 60 * 10).unref();
        } catch (ex) {
            console.error(ex.stack);
            process.exit(1);
        }
    };
};

process.on('exit', (code) => {
    console.log('Process exit event with code:', code);
});

console.log(`CVMFundExplorer v${packageJSON.version}`);

const hiddenKey = ['PASSWORD', 'USERNAME', 'TOKEN'];

yargs
    .example('$0 run cvmDataWorker', 'Download, convert and insert data from CVM to database.')
    .example('$0 run cvmStatisticWorker -b', 'Load CVM data from database and generate financial information.')
    .example('$0 run xpiFundWorker', 'Load XPI data.')
    .example('$0 run migrateWorker', 'Migrate database.')

    .command('run <workerName> [options...]', 'run a worker', (yargs) => {
        return yargs
            .positional('workerName', {
                alias: 'worker',
                describe: 'worker name (cvmDataWorker, cvmStatisticWorker, xpiFundWorker, all)'
            })
            .version(false);
    }, createCommandHandler(async (argv) => {
        const worker = argv.worker;

        console.log('\nCONFIG ----------------------------------------------');
        Object.keys(CONFIG).map(itemKey => hiddenKey.some(v => itemKey.includes(v)) ? itemKey : itemKey + ': ' + CONFIG[itemKey]).map(line => console.log(line));
        console.log('-------------------------------------------------------\n');

        const workers = [
            'cvmDataWorker',
            'eodDataWorker',
            'wtdDataWorker',
            'bcbDataWorker',
            'b3DataWorker',
            'cvmStatisticWorker',
            'dataImprovementWorker',
            'btgPactualFundWorker',
            'modalMaisFundWorker',
            'xpiFundWorker',
            'migrateWorker'
        ];

        const foundWorker = workers.find(workerItem => workerItem.toLowerCase() == worker.toLowerCase());
        let workersToRun = [];

        if (foundWorker) workersToRun.push(foundWorker);
        else if (worker.toLowerCase() == 'all') workersToRun = workers;
        else console.log(`Worker with name '${worker}' not found!`);

        for (let workerToRun of workersToRun) {
            const Worker = require(`../lib/worker/${workerToRun}`);
            await (new Worker()).work(argv);
        }
    }))
    .demandCommand(1)
    .version()
    .help('h')
    .alias('h', 'help')
    .wrap(yargs.terminalWidth())
    .argv;