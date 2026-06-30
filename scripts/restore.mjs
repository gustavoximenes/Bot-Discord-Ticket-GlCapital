import { config } from 'dotenv';
import { program } from 'commander';
import fse from 'fs-extra';
import ora from 'ora';
import { PrismaClient } from '@prisma/client';

config();

program
	.requiredOption('-f, --file <path>', 'the path of the dump to import')
	.requiredOption('-y, --yes', 'yes, DELETE EVERYTHING in the database');

program.parse();

const options = program.opts();

let spinner = ora('Connecting').start();

const prisma = new PrismaClient();

spinner.succeed('Connected');

spinner = ora(`Reading ${options.file}`).start();
const dump = JSON.parse(await fse.promises.readFile(options.file, 'utf8'));
spinner.succeed(`Parsed ${options.file}`);

// ! this order is important
const queries = [
	prisma.guild.deleteMany(),
	prisma.user.deleteMany(),
];

for (const [model, data] of dump) queries.push(prisma[model].createMany({ data }));
spinner = ora('Importing').start();
const [,, ...results] = await prisma.$transaction(queries);
for (const idx in results) spinner.succeed(`Imported ${results[idx].count} into ${dump[idx][0]}`);
process.exit(0);
