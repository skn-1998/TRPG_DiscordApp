import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'
import { isAttributeNumberParts, isAttributeSection } from '../../../core/types/attribute.types'

@ValidatorConstraint({ name: 'attributeNumberParts', async: false })
export class AttributeNumberPartsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isAttributeNumberParts(value)
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property}は有限数だけを値に持つオブジェクトで指定してください`
  }
}

@ValidatorConstraint({ name: 'attributeSection', async: false })
export class AttributeSectionConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isAttributeSection(value)
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property}はAttributeSection正準形で指定してください`
  }
}
