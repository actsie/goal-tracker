export const CURRENT_SCHEMA_VERSION = '1.0.0';

export interface ExportData {
  schemaVersion: string;
  exportTimestamp: string;
  dayData: ExportDayData[];
  goals: ExportGoal[];
}

export interface ExportDayData {
  date: string;
  notes: ExportNote[];
  checklist: ExportChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ExportNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportGoal {
  id: string;
  name: string;
  createdAt: string;
}

export interface ValidationError {
  type: 'error' | 'warning';
  field: string;
  message: string;
  value?: any;
}

export function validateExportSchema(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if data is an object
  if (!data || typeof data !== 'object') {
    errors.push({
      type: 'error',
      field: 'root',
      message: 'Export data must be a valid JSON object'
    });
    return errors;
  }

  // Validate schema version
  if (!data.schemaVersion || typeof data.schemaVersion !== 'string') {
    errors.push({
      type: 'error',
      field: 'schemaVersion',
      message: 'Missing or invalid schema version'
    });
  } else if (data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push({
      type: 'warning',
      field: 'schemaVersion',
      message: `Schema version ${data.schemaVersion} may not be compatible with current version ${CURRENT_SCHEMA_VERSION}`,
      value: data.schemaVersion
    });
  }

  // Validate export timestamp
  if (!data.exportTimestamp || typeof data.exportTimestamp !== 'string') {
    errors.push({
      type: 'error',
      field: 'exportTimestamp',
      message: 'Missing or invalid export timestamp'
    });
  } else if (isNaN(Date.parse(data.exportTimestamp))) {
    errors.push({
      type: 'error',
      field: 'exportTimestamp',
      message: 'Invalid timestamp format',
      value: data.exportTimestamp
    });
  }

  // Validate dayData array
  if (!Array.isArray(data.dayData)) {
    errors.push({
      type: 'error',
      field: 'dayData',
      message: 'dayData must be an array'
    });
  } else {
    data.dayData.forEach((dayData: any, index: number) => {
      errors.push(...validateDayData(dayData, `dayData[${index}]`));
    });
  }

  // Validate goals array
  if (!Array.isArray(data.goals)) {
    errors.push({
      type: 'error',
      field: 'goals',
      message: 'goals must be an array'
    });
  } else {
    data.goals.forEach((goal: any, index: number) => {
      errors.push(...validateGoal(goal, `goals[${index}]`));
    });
  }

  return errors;
}

function validateDayData(dayData: any, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!dayData || typeof dayData !== 'object') {
    errors.push({
      type: 'error',
      field: fieldPath,
      message: 'Day data must be an object'
    });
    return errors;
  }

  // Validate date
  if (!dayData.date || typeof dayData.date !== 'string') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.date`,
      message: 'Missing or invalid date'
    });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dayData.date)) {
    errors.push({
      type: 'error',
      field: `${fieldPath}.date`,
      message: 'Date must be in YYYY-MM-DD format',
      value: dayData.date
    });
  }

  // Validate timestamps
  ['createdAt', 'updatedAt'].forEach(field => {
    if (!dayData[field] || typeof dayData[field] !== 'string') {
      errors.push({
        type: 'error',
        field: `${fieldPath}.${field}`,
        message: `Missing or invalid ${field}`
      });
    } else if (isNaN(Date.parse(dayData[field]))) {
      errors.push({
        type: 'error',
        field: `${fieldPath}.${field}`,
        message: `Invalid ${field} format`,
        value: dayData[field]
      });
    }
  });

  // Validate notes array
  if (!Array.isArray(dayData.notes)) {
    errors.push({
      type: 'error',
      field: `${fieldPath}.notes`,
      message: 'notes must be an array'
    });
  } else {
    dayData.notes.forEach((note: any, index: number) => {
      errors.push(...validateNote(note, `${fieldPath}.notes[${index}]`));
    });
  }

  // Validate checklist array
  if (!Array.isArray(dayData.checklist)) {
    errors.push({
      type: 'error',
      field: `${fieldPath}.checklist`,
      message: 'checklist must be an array'
    });
  } else {
    dayData.checklist.forEach((item: any, index: number) => {
      errors.push(...validateChecklistItem(item, `${fieldPath}.checklist[${index}]`));
    });
  }

  return errors;
}

function validateNote(note: any, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!note || typeof note !== 'object') {
    errors.push({
      type: 'error',
      field: fieldPath,
      message: 'Note must be an object'
    });
    return errors;
  }

  // Validate required fields
  if (!note.id || typeof note.id !== 'string') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.id`,
      message: 'Missing or invalid note ID'
    });
  }

  if (typeof note.content !== 'string') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.content`,
      message: 'Note content must be a string'
    });
  }

  // Validate timestamps
  ['createdAt', 'updatedAt'].forEach(field => {
    if (!note[field] || typeof note[field] !== 'string') {
      errors.push({
        type: 'error',
        field: `${fieldPath}.${field}`,
        message: `Missing or invalid ${field}`
      });
    } else if (isNaN(Date.parse(note[field]))) {
      errors.push({
        type: 'error',
        field: `${fieldPath}.${field}`,
        message: `Invalid ${field} format`,
        value: note[field]
      });
    }
  });

  return errors;
}

function validateChecklistItem(item: any, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!item || typeof item !== 'object') {
    errors.push({
      type: 'error',
      field: fieldPath,
      message: 'Checklist item must be an object'
    });
    return errors;
  }

  // Validate required fields
  if (!item.id || typeof item.id !== 'string') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.id`,
      message: 'Missing or invalid checklist item ID'
    });
  }

  if (typeof item.text !== 'string') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.text`,
      message: 'Checklist item text must be a string'
    });
  }

  if (typeof item.completed !== 'boolean') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.completed`,
      message: 'Checklist item completed must be a boolean'
    });
  }

  if (typeof item.order !== 'number') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.order`,
      message: 'Checklist item order must be a number'
    });
  }

  // Validate timestamps
  ['createdAt', 'updatedAt'].forEach(field => {
    if (!item[field] || typeof item[field] !== 'string') {
      errors.push({
        type: 'error',
        field: `${fieldPath}.${field}`,
        message: `Missing or invalid ${field}`
      });
    } else if (isNaN(Date.parse(item[field]))) {
      errors.push({
        type: 'error',
        field: `${fieldPath}.${field}`,
        message: `Invalid ${field} format`,
        value: item[field]
      });
    }
  });

  return errors;
}

function validateGoal(goal: any, fieldPath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!goal || typeof goal !== 'object') {
    errors.push({
      type: 'error',
      field: fieldPath,
      message: 'Goal must be an object'
    });
    return errors;
  }

  // Validate required fields
  if (!goal.id || typeof goal.id !== 'string') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.id`,
      message: 'Missing or invalid goal ID'
    });
  }

  if (!goal.name || typeof goal.name !== 'string') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.name`,
      message: 'Missing or invalid goal name'
    });
  }

  if (!goal.createdAt || typeof goal.createdAt !== 'string') {
    errors.push({
      type: 'error',
      field: `${fieldPath}.createdAt`,
      message: 'Missing or invalid createdAt'
    });
  } else if (isNaN(Date.parse(goal.createdAt))) {
    errors.push({
      type: 'error',
      field: `${fieldPath}.createdAt`,
      message: 'Invalid createdAt format',
      value: goal.createdAt
    });
  }

  return errors;
}