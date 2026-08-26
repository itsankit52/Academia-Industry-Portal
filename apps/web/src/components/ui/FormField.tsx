import { type ReactNode } from 'react';
import { type Control, type FieldValues, type Path, useController } from 'react-hook-form';
import Input from './Input';
import Textarea from './Textarea';
import Select from './Select';

interface BaseProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  control: Control<T>;
  helperText?: string;
  disabled?: boolean;
}

type InputFieldProps<T extends FieldValues> = BaseProps<T> & {
  as?: 'input';
  type?: string;
  placeholder?: string;
};

type TextareaFieldProps<T extends FieldValues> = BaseProps<T> & {
  as: 'textarea';
  rows?: number;
  placeholder?: string;
};

type SelectFieldProps<T extends FieldValues> = BaseProps<T> & {
  as: 'select';
  options: { value: string; label: string }[];
  placeholder?: string;
};

type FormFieldProps<T extends FieldValues> =
  | InputFieldProps<T>
  | TextareaFieldProps<T>
  | SelectFieldProps<T>;

export default function FormField<T extends FieldValues>(props: FormFieldProps<T>): ReactNode {
  const { name, label, control, helperText, disabled } = props;
  const { field, fieldState } = useController({ name, control });
  const error = fieldState.error?.message;

  if (props.as === 'textarea') {
    return (
      <Textarea
        {...field}
        label={label}
        error={error}
        helperText={helperText}
        disabled={disabled}
        rows={props.rows}
        placeholder={props.placeholder}
      />
    );
  }

  if (props.as === 'select') {
    return (
      <Select
        {...field}
        label={label}
        error={error}
        helperText={helperText}
        disabled={disabled}
        options={props.options}
        placeholder={props.placeholder}
      />
    );
  }

  return (
    <Input
      {...field}
      label={label}
      error={error}
      helperText={helperText}
      disabled={disabled}
      type={props.type ?? 'text'}
      placeholder={props.placeholder}
    />
  );
}
