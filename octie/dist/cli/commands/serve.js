/**
 * Serve command - Start web UI server
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { getProjectPath, info, error } from '../utils/helpers.js';
import { createServer, WebServer } from '../../web/server.js';
import { registerProject, isValidOctieProject } from '../../core/registry/index.js';
/**
 * Create the serve command
 */
export const serveCommand = new Command('serve')
    .description('Start web UI server for task visualization')
    .option('-p, --port <number>', 'Port to run server on', '3456')
    .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
    .option('--open', 'Open browser automatically')
    .option('--cors-origin <origin>', 'Explicit browser origin allowed for cross-origin API requests')
    .option('--api-token <token>', 'API token (required with a non-local host)')
    .option('--no-logging', 'Disable request logging')
    .option('--project <path>', 'Path to Octie project directory')
    .addHelpText('after', `
Examples:
  $ octie serve                    Start server on default port 3456
  $ octie serve -p 8080           Use custom port
  $ octie serve --open             Open browser automatically
  $ octie serve --host 0.0.0.0    Allow external connections
  $ octie serve --host 0.0.0.0 --api-token <token>  Allow authenticated external connections
  $ octie serve --no-logging       Disable request logging
  $ octie serve --project /path    Serve specific project

Default: 127.0.0.1:3456
`)
    .action(async (options) => {
    try {
        const projectPath = await getProjectPath(options.project);
        info(`Starting web server for project at ${projectPath}`);
        // Register project in global registry
        if (isValidOctieProject(projectPath)) {
            registerProject(projectPath);
        }
        const serverOptions = {
            port: parseInt(options.port, 10),
            host: options.host,
            open: options.open,
            cors: Boolean(options.corsOrigin),
            corsOrigin: options.corsOrigin,
            apiToken: options.apiToken,
            logging: options.logging !== false,
        };
        const server = await createServer(projectPath, serverOptions);
        // Print enhanced URL info
        printServerInfo(server, projectPath, serverOptions);
        // Keep process alive
        process.on('SIGTERM', async () => {
            info('Shutting down server...');
            await server.stop();
            process.exit(0);
        });
        process.on('SIGINT', async () => {
            info('\nShutting down server...');
            await server.stop();
            process.exit(0);
        });
    }
    catch (err) {
        if (err instanceof Error) {
            error(err.message);
        }
        else {
            error('Failed to start server');
        }
        process.exit(1);
    }
});
/**
 * Print server URL information
 */
function printServerInfo(server, projectPath, _options) {
    const baseUrl = server.url;
    const projectUrl = `${baseUrl}/?project=${encodeURIComponent(projectPath)}`;
    const homeUrl = baseUrl;
    const isDev = process.env.NODE_ENV === 'development';
    console.log('');
    console.log(chalk.green('🚀 Octie Web Server started'));
    console.log(chalk.blue('📍 Project: ') + projectPath);
    console.log('');
    console.log(chalk.cyan('🔗 URLs:'));
    console.log(`   ${chalk.dim('Project:')} ${chalk.white(projectUrl)}`);
    console.log(`   ${chalk.dim('Home:')}    ${chalk.white(homeUrl)}`);
    if (isDev) {
        console.log(`   ${chalk.dim('API Test:')} ${chalk.white(`${baseUrl}/test`)}`);
        console.log(`   ${chalk.dim('API Info:')} ${chalk.white(`${baseUrl}/api`)}`);
    }
    console.log('');
    console.log(chalk.dim('Press Ctrl+C to stop'));
    console.log('');
}
//# sourceMappingURL=serve.js.map