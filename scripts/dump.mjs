import { config } from 'dotenv';
import fse from 'fs-extra';
import { join } from 'path';
import ora from 'ora';
import { PrismaClient } from '@prisma/client';
import DTF from '@eartharoid/dtf';

config();

const dtf = new DTF('en-GB');

let spinner = ora('Connecting').start();

fse.ensureDirSync(join(process.cwd(), './user/dumps'));
const file_path = join(process.cwd(), './user/dumps', `${dtf.fill('YYYY-MM-DD-HH-mm-ss')}-db.json`);

const prisma = new PrismaClient();

spinner.succeed('Connected');

const models = [
	'user',
	'guild',
	'tag',
	'category',
	'question',
	'ticket',
	'feedback',
	'questionAnswer',
	'archivedChannel',
	'archivedRole',
	'archivedUser',
	'archivedMessage',
];

const dump = await Promise.all(
	models.map(async model => {
		spinner = ora(`Exporting ${model}`).start();
		const data = await prisma[model].findMany();
		spinner.succeed(`Exported ${data.length} from ${model}`);
		return [model, data];
	}),
);

spinner = ora('Writing').start();
await fse.promises.writeFile(file_path, JSON.stringify(dump));
spinner.succeed(`Written to "${file_path}"`);
process.exit(0);
