import { type Command, type SerializableCommand } from './undoRedo';
import { 
  addNote, 
  updateNote, 
  deleteNote, 
  addChecklistItem, 
  updateChecklistItem, 
  deleteChecklistItem, 
  reorderChecklistItems,
  getDayData,
  type Note,
  type ChecklistItem 
} from './db';

// Base command with common functionality
abstract class BaseCommand implements Command {
  id: string;
  type: string;
  dateKey: string;
  timestamp: Date;

  constructor(type: string, dateKey: string) {
    this.id = crypto.randomUUID();
    this.type = type;
    this.dateKey = dateKey;
    this.timestamp = new Date();
  }

  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;
  
  merge?(_other: Command): Command | null {
    return null; // Default: no merging
  }
}

// Note Commands

export class AddNoteCommand extends BaseCommand {
  private noteId: string | null = null;
  private content: string;
  private onNoteAdded?: (note: Note) => void;

  constructor(dateKey: string, content: string, onNoteAdded?: (note: Note) => void) {
    super('add-note', dateKey);
    this.content = content;
    this.onNoteAdded = onNoteAdded;
  }

  async execute(): Promise<void> {
    const note = await addNote(this.dateKey, this.content);
    this.noteId = note.id;
    this.onNoteAdded?.(note);
  }

  async undo(): Promise<void> {
    if (this.noteId) {
      await deleteNote(this.dateKey, this.noteId);
    }
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        content: this.content,
        noteId: this.noteId
      }
    };
  }

  static fromSerialized(data: SerializableCommand): AddNoteCommand {
    const command = new AddNoteCommand(data.dateKey, data.data.content);
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    command.noteId = data.data.noteId;
    return command;
  }
}

export class EditNoteCommand extends BaseCommand {
  private noteId: string;
  private newContent: string;
  private oldContent: string;
  private onNoteUpdated?: () => void;

  constructor(
    dateKey: string, 
    noteId: string, 
    oldContent: string, 
    newContent: string,
    onNoteUpdated?: () => void
  ) {
    super('edit-note', dateKey);
    this.noteId = noteId;
    this.oldContent = oldContent;
    this.newContent = newContent;
    this.onNoteUpdated = onNoteUpdated;
  }

  async execute(): Promise<void> {
    await updateNote(this.dateKey, this.noteId, this.newContent);
    this.onNoteUpdated?.();
  }

  async undo(): Promise<void> {
    await updateNote(this.dateKey, this.noteId, this.oldContent);
    this.onNoteUpdated?.();
  }

  // Merge consecutive text edits
  merge(other: Command): Command | null {
    if (other instanceof EditNoteCommand && 
        other.noteId === this.noteId && 
        other.type === this.type &&
        (other.timestamp.getTime() - this.timestamp.getTime()) < 2000) { // 2 second window
      // Create merged command with original old content and latest new content
      const mergedCommand = new EditNoteCommand(
        this.dateKey,
        this.noteId,
        this.oldContent, // Keep original old content
        other.newContent, // Use latest new content
        this.onNoteUpdated
      );
      // Copy the newer timestamp
      mergedCommand.timestamp = other.timestamp;
      return mergedCommand;
    }
    return null;
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        noteId: this.noteId,
        oldContent: this.oldContent,
        newContent: this.newContent
      }
    };
  }

  static fromSerialized(data: SerializableCommand): EditNoteCommand {
    const command = new EditNoteCommand(
      data.dateKey,
      data.data.noteId,
      data.data.oldContent,
      data.data.newContent
    );
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    return command;
  }
}

export class DeleteNoteCommand extends BaseCommand {
  private noteId: string;
  private deletedNote: Note | null = null;
  private onNoteDeleted?: () => void;
  private onNoteRestored?: (note: Note) => void;

  constructor(
    dateKey: string, 
    noteId: string,
    onNoteDeleted?: () => void,
    onNoteRestored?: (note: Note) => void
  ) {
    super('delete-note', dateKey);
    this.noteId = noteId;
    this.onNoteDeleted = onNoteDeleted;
    this.onNoteRestored = onNoteRestored;
  }

  async execute(): Promise<void> {
    // Store the note data before deletion
    const dayData = await getDayData(this.dateKey);
    this.deletedNote = dayData?.notes.find(n => n.id === this.noteId) || null;
    
    await deleteNote(this.dateKey, this.noteId);
    this.onNoteDeleted?.();
  }

  async undo(): Promise<void> {
    if (this.deletedNote) {
      const note = await addNote(this.dateKey, this.deletedNote.content);
      this.onNoteRestored?.(note);
    }
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        noteId: this.noteId,
        deletedNote: this.deletedNote
      }
    };
  }

  static fromSerialized(data: SerializableCommand): DeleteNoteCommand {
    const command = new DeleteNoteCommand(data.dateKey, data.data.noteId);
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    command.deletedNote = data.data.deletedNote;
    return command;
  }
}

// Checklist Commands

export class AddChecklistItemCommand extends BaseCommand {
  private itemId: string | null = null;
  private text: string;
  private onItemAdded?: (item: ChecklistItem) => void;

  constructor(dateKey: string, text: string, onItemAdded?: (item: ChecklistItem) => void) {
    super('add-checklist-item', dateKey);
    this.text = text;
    this.onItemAdded = onItemAdded;
  }

  async execute(): Promise<void> {
    const item = await addChecklistItem(this.dateKey, this.text);
    this.itemId = item.id;
    this.onItemAdded?.(item);
  }

  async undo(): Promise<void> {
    if (this.itemId) {
      await deleteChecklistItem(this.dateKey, this.itemId);
    }
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        text: this.text,
        itemId: this.itemId
      }
    };
  }

  static fromSerialized(data: SerializableCommand): AddChecklistItemCommand {
    const command = new AddChecklistItemCommand(data.dateKey, data.data.text);
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    command.itemId = data.data.itemId;
    return command;
  }
}

export class EditChecklistItemCommand extends BaseCommand {
  private itemId: string;
  private newText: string;
  private oldText: string;
  private onItemUpdated?: () => void;

  constructor(
    dateKey: string, 
    itemId: string, 
    oldText: string, 
    newText: string,
    onItemUpdated?: () => void
  ) {
    super('edit-checklist-item', dateKey);
    this.itemId = itemId;
    this.oldText = oldText;
    this.newText = newText;
    this.onItemUpdated = onItemUpdated;
  }

  async execute(): Promise<void> {
    await updateChecklistItem(this.dateKey, this.itemId, { text: this.newText });
    this.onItemUpdated?.();
  }

  async undo(): Promise<void> {
    await updateChecklistItem(this.dateKey, this.itemId, { text: this.oldText });
    this.onItemUpdated?.();
  }

  // Merge consecutive text edits
  merge(other: Command): Command | null {
    if (other instanceof EditChecklistItemCommand && 
        other.itemId === this.itemId && 
        other.type === this.type &&
        (other.timestamp.getTime() - this.timestamp.getTime()) < 1500) { // 1.5 second window
      // Create merged command with original old content and latest new content
      const mergedCommand = new EditChecklistItemCommand(
        this.dateKey,
        this.itemId,
        this.oldText, // Keep original old content
        other.newText, // Use latest new content
        this.onItemUpdated
      );
      // Copy the newer timestamp
      mergedCommand.timestamp = other.timestamp;
      return mergedCommand;
    }
    return null;
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        itemId: this.itemId,
        oldText: this.oldText,
        newText: this.newText
      }
    };
  }

  static fromSerialized(data: SerializableCommand): EditChecklistItemCommand {
    const command = new EditChecklistItemCommand(
      data.dateKey,
      data.data.itemId,
      data.data.oldText,
      data.data.newText
    );
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    return command;
  }
}

export class ToggleChecklistItemCommand extends BaseCommand {
  private itemId: string;
  private onItemToggled?: () => void;

  constructor(dateKey: string, itemId: string, onItemToggled?: () => void) {
    super('toggle-checklist-item', dateKey);
    this.itemId = itemId;
    this.onItemToggled = onItemToggled;
  }

  async execute(): Promise<void> {
    const dayData = await getDayData(this.dateKey);
    const item = dayData?.checklist.find(i => i.id === this.itemId);
    if (item) {
      await updateChecklistItem(this.dateKey, this.itemId, { completed: !item.completed });
      this.onItemToggled?.();
    }
  }

  async undo(): Promise<void> {
    const dayData = await getDayData(this.dateKey);
    const item = dayData?.checklist.find(i => i.id === this.itemId);
    if (item) {
      await updateChecklistItem(this.dateKey, this.itemId, { completed: !item.completed });
      this.onItemToggled?.();
    }
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        itemId: this.itemId
      }
    };
  }

  static fromSerialized(data: SerializableCommand): ToggleChecklistItemCommand {
    const command = new ToggleChecklistItemCommand(data.dateKey, data.data.itemId);
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    return command;
  }
}

export class DeleteChecklistItemCommand extends BaseCommand {
  private itemId: string;
  private deletedItem: ChecklistItem | null = null;
  private onItemDeleted?: () => void;
  private onItemRestored?: (item: ChecklistItem) => void;

  constructor(
    dateKey: string, 
    itemId: string,
    onItemDeleted?: () => void,
    onItemRestored?: (item: ChecklistItem) => void
  ) {
    super('delete-checklist-item', dateKey);
    this.itemId = itemId;
    this.onItemDeleted = onItemDeleted;
    this.onItemRestored = onItemRestored;
  }

  async execute(): Promise<void> {
    // Store the item data before deletion
    const dayData = await getDayData(this.dateKey);
    this.deletedItem = dayData?.checklist.find(i => i.id === this.itemId) || null;
    
    await deleteChecklistItem(this.dateKey, this.itemId);
    this.onItemDeleted?.();
  }

  async undo(): Promise<void> {
    if (this.deletedItem) {
      const item = await addChecklistItem(this.dateKey, this.deletedItem.text);
      if (this.deletedItem.completed) {
        await updateChecklistItem(this.dateKey, item.id, { completed: true });
      }
      this.onItemRestored?.(item);
    }
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        itemId: this.itemId,
        deletedItem: this.deletedItem
      }
    };
  }

  static fromSerialized(data: SerializableCommand): DeleteChecklistItemCommand {
    const command = new DeleteChecklistItemCommand(data.dateKey, data.data.itemId);
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    command.deletedItem = data.data.deletedItem;
    return command;
  }
}

export class ReorderChecklistCommand extends BaseCommand {
  private newOrder: string[];
  private oldOrder: string[] = [];
  private onItemsReordered?: () => void;

  constructor(
    dateKey: string, 
    newOrder: string[],
    onItemsReordered?: () => void
  ) {
    super('reorder-checklist', dateKey);
    this.newOrder = newOrder;
    this.onItemsReordered = onItemsReordered;
  }

  async execute(): Promise<void> {
    // Store the current order before reordering
    const dayData = await getDayData(this.dateKey);
    if (dayData) {
      this.oldOrder = dayData.checklist
        .sort((a, b) => a.order - b.order)
        .map(item => item.id);
    }
    
    await reorderChecklistItems(this.dateKey, this.newOrder);
    this.onItemsReordered?.();
  }

  async undo(): Promise<void> {
    if (this.oldOrder.length > 0) {
      await reorderChecklistItems(this.dateKey, this.oldOrder);
      this.onItemsReordered?.();
    }
  }

  // Merge consecutive reorders within a short time window
  merge(other: Command): Command | null {
    if (other instanceof ReorderChecklistCommand && 
        other.type === this.type &&
        (other.timestamp.getTime() - this.timestamp.getTime()) < 500) { // 0.5 second window for reorders
      const mergedCommand = new ReorderChecklistCommand(
        this.dateKey,
        other.newOrder, // Use latest order
        this.onItemsReordered
      );
      // Keep the older command's old order
      mergedCommand['oldOrder'] = this.oldOrder;
      // Copy the newer timestamp
      mergedCommand.timestamp = other.timestamp;
      return mergedCommand;
    }
    return null;
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        newOrder: this.newOrder,
        oldOrder: this.oldOrder
      }
    };
  }

  static fromSerialized(data: SerializableCommand): ReorderChecklistCommand {
    const command = new ReorderChecklistCommand(data.dateKey, data.data.newOrder);
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    command['oldOrder'] = data.data.oldOrder;
    return command;
  }
}

// Batch command for multiple operations
export class BatchCommand extends BaseCommand {
  private commands: Command[];
  private description: string;

  constructor(dateKey: string, commands: Command[], description: string) {
    super('batch', dateKey);
    this.commands = commands;
    this.description = description;
  }

  async execute(): Promise<void> {
    for (const command of this.commands) {
      await command.execute();
    }
  }

  async undo(): Promise<void> {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo();
    }
  }

  getDescription(): string {
    return this.description;
  }

  serialize(): SerializableCommand {
    return {
      id: this.id,
      type: this.type,
      dateKey: this.dateKey,
      timestamp: this.timestamp.toISOString(),
      data: {
        commands: this.commands.map(cmd => cmd.serialize?.() || null).filter(Boolean),
        description: this.description
      }
    };
  }

  static fromSerialized(data: SerializableCommand): BatchCommand {
    const commands = data.data.commands.map((cmdData: SerializableCommand) => 
      deserializeCommand(cmdData)
    ).filter(Boolean) as Command[];
    
    const command = new BatchCommand(data.dateKey, commands, data.data.description);
    command.id = data.id;
    command.timestamp = new Date(data.timestamp);
    return command;
  }
}

// Command factory for deserialization
export function deserializeCommand(data: SerializableCommand): Command | null {
  try {
    switch (data.type) {
      case 'add-note':
        return AddNoteCommand.fromSerialized(data);
      case 'edit-note':
        return EditNoteCommand.fromSerialized(data);
      case 'delete-note':
        return DeleteNoteCommand.fromSerialized(data);
      case 'add-checklist-item':
        return AddChecklistItemCommand.fromSerialized(data);
      case 'edit-checklist-item':
        return EditChecklistItemCommand.fromSerialized(data);
      case 'toggle-checklist-item':
        return ToggleChecklistItemCommand.fromSerialized(data);
      case 'delete-checklist-item':
        return DeleteChecklistItemCommand.fromSerialized(data);
      case 'reorder-checklist':
        return ReorderChecklistCommand.fromSerialized(data);
      case 'batch':
        return BatchCommand.fromSerialized(data);
      default:
        console.warn(`Unknown command type for deserialization: ${data.type}`);
        return null;
    }
  } catch (error) {
    console.error(`Failed to deserialize command of type ${data.type}:`, error);
    return null;
  }
}