type FormItemProps = {
  label?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
} & JSX.IntrinsicElements["div"];

export const FormItem = ({
  label,
  error,
  children,
  ...props
}: FormItemProps) => {
  return (
    <div {...props}>
      {label && (
        <div className="flex items-center justify-between">{label}</div>
      )}
      <div className={label ? "mt-2" : undefined}>{children}</div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};
