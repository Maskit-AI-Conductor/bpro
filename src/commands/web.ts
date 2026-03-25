/**
 * fugue web — Start local web dashboard.
 */

import os from 'node:os';
import { Command } from 'commander';
import chalk from 'chalk';
import { requireFugueDir } from '../core/project.js';
import { startServer } from '../web/server.js';

export const webCommand = new Command('web')
  .description('Start local web dashboard')
  .option('-p, --port <port>', 'Port number', '4000')
  .action(async (opts) => {
    try {
      const fugueDir = requireFugueDir();
      const port = parseInt(opts.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(chalk.red.bold('ERR') + ' Invalid port number');
        process.exit(1);
      }

      const server = startServer(fugueDir, port);

      server.on('listening', () => {
        console.log();
        console.log(`  ${chalk.green.bold('fugue dashboard')} running at:`);
        console.log();
        console.log(`  ${chalk.cyan(`http://localhost:${port}`)}`);

        // Print LAN IPs
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
          for (const net of nets[name] ?? []) {
            if (net.family === 'IPv4' && !net.internal) {
              console.log(`  ${chalk.dim('LAN:')} ${chalk.cyan(`http://${net.address}:${port}`)}`);
            }
          }
        }

        console.log();
        console.log(`  ${chalk.dim('Press Ctrl+C to stop')}`);
        console.log();
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(chalk.red.bold('ERR') + ` Port ${port} is already in use. Try --port <other>`);
        } else {
          console.error(chalk.red.bold('ERR') + ` ${err.message}`);
        }
        process.exit(1);
      });

      // Keep process running
      process.on('SIGINT', () => {
        console.log();
        console.log(chalk.dim('  Stopping dashboard...'));
        server.close();
        process.exit(0);
      });

    } catch (err: unknown) {
      console.error(chalk.red.bold('ERR') + ` ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
