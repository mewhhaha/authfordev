import { cn } from "~/css/cn";

type CutoutErrorProps = {
  show?: boolean;
  label: React.ReactNode;
  children: React.ReactNode;
};

export const AlertError = ({ show, label, children }: CutoutErrorProps) => {
  return (
    <div
      className={cn(
        show
          ? "mt-4 h-36 font-serif opacity-100 transition-[height,opacity]"
          : "mt-0 h-1 opacity-0",
        "overflow-hidden"
      )}
    >
      <section
        className={cn(
          "h-full transition-[transform,opacity] duration-500 ease-in-out",
          show ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
          "flex w-full flex-col border-l-2 border-t-2 border-dashed border-red-600 p-2 ring ring-inset ring-white backdrop-sepia"
        )}
      >
        <div
          aria-hidden
          className="-mr-9 ml-auto text-xl font-extrabold tracking-wider opacity-50"
        >
          The Error
        </div>
        <hr aria-hidden className="mb-1 mt-2 w-[120%] border-black/50" />
        <div>
          <label className="font-semibold tracking-wide">{label}</label>
          <p className="text-sm">{children}</p>
        </div>
      </section>
    </div>
  );
};
