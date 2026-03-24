/**
 * bpro config — Configuration management.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { requireBproDir, loadConfig, saveConfig, loadModels } from '../core/project.js';
import { printSuccess, printError, printWarning } from '../utils/display.js';

export const configCommand = new Command('config')
  .description('Manage bpro configuration');

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value (e.g. conductor)')
  .action(async (key: string, value: string) => {
    try {
      const bproDir = requireBproDir();
      const config = loadConfig(bproDir);

      switch (key) {
        case 'conductor': {
          // Verify the model is registered
          const registry = loadModels(bproDir);
          const model = registry.models.find((m) => m.name === value);
          if (!model) {
            printWarning(`Model '${value}' is not registered.`);
            console.log(`  Register it first: ${chalk.cyan(`bpro model add ${value}`)}`);
            console.log(`  Or pick from: ${chalk.cyan('bpro model list')}`);
            process.exit(1);
          }
          config.conductor = value;
          saveConfig(bproDir, config);
          printSuccess(`Conductor set to '${value}' (${model.provider})`);
          break;
        }
        default:
          // Generic key-value set
          (config as Record<string, unknown>)[key] = value;
          saveConfig(bproDir, config);
          printSuccess(`${key} = ${value}`);
      }
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    try {
      const bproDir = requireBproDir();
      const config = loadConfig(bproDir);
      const registry = loadModels(bproDir);

      console.log();
      console.log(`  ${chalk.bold('bpro Configuration')}`);
      console.log(`  ${chalk.dim('-'.repeat(40))}`);
      console.log(`  Project:    ${chalk.cyan(config.project_name)}`);
      console.log(`  Version:    ${config.version}`);
      console.log(`  Created:    ${config.created}`);

      if (config.conductor) {
        const model = registry.models.find((m) => m.name === config.conductor);
        console.log(`  Conductor:  ${chalk.yellow(config.conductor)} (${model?.provider ?? 'unknown'})`);
      } else {
        console.log(`  Conductor:  ${chalk.dim('not set')}`);
      }

      console.log(`  Models:     ${registry.models.length} registered`);
      console.log();

      if (config.scan) {
        console.log(`  ${chalk.bold('Scan')}`);
        console.log(`  Include: ${config.scan.include.length} patterns`);
        console.log(`  Exclude: ${config.scan.exclude.length} patterns`);
      }

      if (config.plan?.source) {
        console.log();
        console.log(`  ${chalk.bold('Plan')}`);
        console.log(`  Source: ${config.plan.source}`);
        console.log(`  Imported: ${config.plan.imported_at ?? 'unknown'}`);
      }
      console.log();
    } catch (err: unknown) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
