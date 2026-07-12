import { BadRequestException, Injectable } from '@nestjs/common'
import { CharacterSheetTemplateEntity, SheetTemplateSection } from '../models/character-sheet-template.entity'
import { collectProjectionKeyErrors } from './projection-key-validation'
import { TemplateValidationPort } from './template-validation.port'

interface FieldLike {
  id?: unknown
  uid?: unknown
  type?: unknown
  role?: unknown
  rowRole?: unknown
  secret?: unknown
  visibleTo?: unknown
  itemFields?: unknown
  when?: unknown
}

@Injectable()
export class BasicTemplateValidationService implements TemplateValidationPort {
  private readonly idPattern = /^[a-z][a-z0-9_]{0,31}$/
  private readonly reservedIds = new Set([
    'row',
    'values',
    'parts',
    'base',
    'other',
    'floor',
    'ceil',
    'round',
    'max',
    'min',
    'lookup',
    'if',
    'sum',
    'count'
  ])
  private readonly allowedRoleKinds = new Set(['rollable', 'resource', 'profile'])
  private readonly allowedFieldTypes = new Set(['scalar', 'computed', 'roll', 'track', 'list', 'relation', 'tag'])
  private readonly maxSections = 64
  private readonly maxTables = 64
  private readonly maxFields = 512
  private readonly maxSerializedBytes = 512 * 1024

  validateForSave(template: CharacterSheetTemplateEntity): void {
    const errors = this.collectCommonErrors(template)
    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '))
    }
  }

  validateForPublish(template: CharacterSheetTemplateEntity): void {
    const errors = this.collectCommonErrors(template)
    errors.push(...collectProjectionKeyErrors(template))
    const fields = this.collectFields(template.sections)

    for (const field of fields) {
      this.validatePublishFieldType(field, errors)
      this.validatePublishListField(field, errors)
      if (field.visibleTo !== undefined && field.visibleTo !== 'public') {
        errors.push(`field ${String(field.id)} has unsupported visibleTo: ${String(field.visibleTo)}`)
      }
      if (field.secret === true) {
        errors.push(`field ${String(field.id)} uses unsupported secret`)
      }
      if (field.when !== undefined) {
        errors.push(`field ${String(field.id)} uses unsupported when`)
      }
    }

    if (template.visibility !== 'public') {
      errors.push('published template visibility must be public')
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '))
    }
  }

  private collectCommonErrors(template: CharacterSheetTemplateEntity): string[] {
    const errors: string[] = []

    if (template.sections.length > this.maxSections) {
      errors.push(`sections must be ${this.maxSections} or fewer`)
    }
    if (template.tables.length > this.maxTables) {
      errors.push(`tables must be ${this.maxTables} or fewer`)
    }
    if (Buffer.byteLength(JSON.stringify(template), 'utf8') > this.maxSerializedBytes) {
      errors.push(`template must be ${this.maxSerializedBytes} bytes or fewer`)
    }

    const seenUids = new Set<string>()
    const fields = this.collectFields(template.sections)
    if (fields.length > this.maxFields) {
      errors.push(`fields must be ${this.maxFields} or fewer`)
    }

    for (const section of template.sections) {
      this.validateIdLike(section.id, 'section id', errors)
    }

    for (const field of fields) {
      this.validateIdLike(field.id, 'field id', errors)
      if (typeof field.uid !== 'string' || field.uid.length === 0) {
        errors.push(`field ${String(field.id)} must have uid`)
      } else if (seenUids.has(field.uid)) {
        errors.push(`duplicate uid: ${field.uid}`)
      } else {
        seenUids.add(field.uid)
      }

      this.validateRole(field, errors)
    }

    return errors
  }

  private validateIdLike(value: unknown, label: string, errors: string[]): void {
    if (typeof value !== 'string' || !this.idPattern.test(value) || this.reservedIds.has(value)) {
      errors.push(`${label} must match [a-z][a-z0-9_]{0,31} and not be reserved`)
    }
  }

  private validateRole(field: FieldLike, errors: string[]): void {
    if (field.role === undefined) {
      return
    }
    this.validateRoleLike(field.id, field.role, 'role', errors)
  }

  private validateRoleLike(fieldId: unknown, role: unknown, label: string, errors: string[]): void {
    if (!this.isRecord(role)) {
      errors.push(`field ${String(fieldId)} ${label} must be an object`)
      return
    }

    const kind = role.kind
    if (typeof kind !== 'string' || !this.allowedRoleKinds.has(kind)) {
      errors.push(`field ${String(fieldId)} has unknown ${label} kind: ${String(kind)}`)
    }
    if (role.secret === true) {
      errors.push(`field ${String(fieldId)} ${label} uses unsupported secret`)
    }
    if (role.when !== undefined) {
      errors.push(`field ${String(fieldId)} ${label} uses unsupported when`)
    }
  }

  private validatePublishFieldType(field: FieldLike, errors: string[]): void {
    if (typeof field.type !== 'string' || !this.allowedFieldTypes.has(field.type)) {
      errors.push(`field ${String(field.id)} has unknown type: ${String(field.type)}`)
    }
  }

  private validatePublishListField(field: FieldLike, errors: string[]): void {
    if (field.type !== 'list') {
      return
    }

    if (field.rowRole !== undefined) {
      this.validateRoleLike(field.id, field.rowRole, 'rowRole', errors)
    }

    if (!Array.isArray(field.itemFields)) {
      return
    }

    for (const itemField of field.itemFields) {
      if (!this.isRecord(itemField)) {
        continue
      }
      const itemType = itemField.type
      if (itemType === 'roll' || itemType === 'list') {
        errors.push(`field ${String(field.id)} itemFields cannot contain ${itemType}`)
      }
    }
  }

  private collectFields(sections: SheetTemplateSection[]): FieldLike[] {
    const fields: FieldLike[] = []
    for (const section of sections) {
      const sectionFields = this.isRecord(section) && Array.isArray(section.fields) ? section.fields : []
      this.collectFieldsRecursive(sectionFields, fields)
    }
    return fields
  }

  private collectFieldsRecursive(candidates: unknown[], fields: FieldLike[]): void {
    for (const candidate of candidates) {
      if (!this.isRecord(candidate)) {
        continue
      }

      const field = candidate as FieldLike
      fields.push(field)
      if (Array.isArray(field.itemFields)) {
        this.collectFieldsRecursive(field.itemFields, fields)
      }
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
