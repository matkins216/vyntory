import { PostgrestError } from '@supabase/supabase-js';

export function handleDatabaseError(error: PostgrestError | Error, operation: string): never {
  if ('code' in error) {
    // This is a PostgrestError
    console.error(`Database error during ${operation}:`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
  } else {
    // This is a regular Error
    console.error(`Error during ${operation}:`, error.message);
  }
  
  throw new Error(`Database operation failed: ${operation}`);
}

export function validateRequiredFields(data: Record<string, any>, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
