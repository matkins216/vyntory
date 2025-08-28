type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    stripeAccountId?: string;
    endpoint?: string;
    userId?: string;
    requestId?: string;
    [key: string]: unknown;
}

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';
    private isProduction = process.env.NODE_ENV === 'production';

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
    }

    private shouldLog(level: LogLevel): boolean {
        if (this.isDevelopment) return true;
        if (this.isProduction) {
            // In production, only log warnings and errors by default
            return ['warn', 'error'].includes(level);
        }
        return false;
    }

    debug(message: string, context?: LogContext): void {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, context));
        }
    }

    info(message: string, context?: LogContext): void {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message, context));
        }
    }

    warn(message: string, context?: LogContext): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, context));
        }
    }

    error(message: string, error?: Error, context?: LogContext): void {
        if (this.shouldLog('error')) {
            const errorDetails = error ? ` | Error: ${error.message} | Stack: ${error.stack}` : '';
            console.error(this.formatMessage('error', message + errorDetails, context));

            // In production, you might want to send this to a logging service
            if (this.isProduction) {
                // TODO: Send to external logging service (e.g., Sentry, LogRocket, etc.)
                this.sendToLoggingService('error', message, error, context);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private sendToLoggingService(level: LogLevel, message: string, error?: Error, context?: LogContext): void {
        // Implement external logging service integration here
        // Example: Sentry, LogRocket, DataDog, etc.
        if (process.env.SENTRY_DSN) {
            // Sentry integration
            // Sentry.captureException(error, { extra: { message, context } });
        }
    }

    // Special method for API endpoints
    api(level: LogLevel, endpoint: string, message: string, context?: LogContext): void {
        const fullContext = context ? { ...context, endpoint } : { endpoint };
        if (level === 'error') {
            this.error(`[API] ${endpoint} - ${message}`, undefined, fullContext);
        } else if (level === 'debug') {
            this.debug(`[API] ${endpoint} - ${message}`, fullContext);
        } else if (level === 'info') {
            this.info(`[API] ${endpoint} - ${message}`, fullContext);
        } else if (level === 'warn') {
            this.warn(`[API] ${endpoint} - ${message}`, fullContext);
        }
    }

    // Special method for Stripe operations
    stripe(level: LogLevel, operation: string, message: string, context?: LogContext): void {
        const fullContext = context ? { ...context, operation } : { operation };
        if (level === 'error') {
            this.error(`[STRIPE] ${operation} - ${message}`, undefined, fullContext);
        } else if (level === 'debug') {
            this.debug(`[STRIPE] ${operation} - ${message}`, fullContext);
        } else if (level === 'info') {
            this.info(`[STRIPE] ${operation} - ${message}`, fullContext);
        } else if (level === 'warn') {
            this.warn(`[STRIPE] ${operation} - ${message}`, fullContext);
        }
    }

    // Special method for database operations
    db(level: LogLevel, operation: string, message: string, context?: LogContext): void {
        const fullContext = context ? { ...context, operation } : { operation };
        if (level === 'error') {
            this.error(`[DB] ${operation} - ${message}`, undefined, fullContext);
        } else if (level === 'debug') {
            this.debug(`[DB] ${operation} - ${message}`, fullContext);
        } else if (level === 'info') {
            this.info(`[DB] ${operation} - ${message}`, fullContext);
        } else if (level === 'warn') {
            this.warn(`[DB] ${operation} - ${message}`, fullContext);
        }
    }
}

export const logger = new Logger();

// Convenience functions
export const logApi = (level: LogLevel, endpoint: string, message: string, context?: LogContext) =>
    logger.api(level, endpoint, message, context);

export const logStripe = (level: LogLevel, operation: string, message: string, context?: LogContext) =>
    logger.stripe(level, operation, message, context);

export const logDb = (level: LogLevel, operation: string, message: string, context?: LogContext) =>
    logger.db(level, operation, message, context);