import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useA11yDialog } from 'react-a11y-dialog';
import { generateId } from '../../utils/id';

interface IDialog {
  title: string;
  dialog: ReactNode | ReactNode[] | RenderDialogFunction;
}
type RenderDialogFunction = (props: {
  close: () => void;
}) => ReactNode | ReactNode[];

export default function Dialog({ title, dialog }: IDialog) {
  // `instance` is the `a11y-dialog` instance.
  // `attr` is an object with the following keys:
  // - `container`: the dialog container
  // - `overlay`: the dialog overlay (sometimes called backdrop)
  // - `dialog`: the actual dialog box
  // - `title`: the dialog mandatory title
  // - `closeButton`:  the dialog close button
  const [instance, attr] = useA11yDialog({
    // The required HTML `id` attribute of the dialog element, internally used
    // a11y-dialog to manipulate the dialog.
    id: `dialog-${generateId()}`,
    // The optional `role` attribute of the dialog element, either `dialog`
    // (default) or `alertdialog` to make it a modal (preventing closing on
    // click outside of ESC key).
    role: 'dialog',
    // The required dialog title, mandatory in the document
    // to provide context to assistive technology.
    title,
  });

  const dialogPortal = createPortal(
    // @ts-expect-error: react-a11y type for container.ref is not incorrect
    // see: https://github.com/KittyGiraudel/a11y-dialog/blob/7.4.0/a11y-dialog.js#L12-L28
    <div {...attr.container} className="dialog-container">
      <div {...attr.overlay} className="dialog-overlay" />
      <div {...attr.dialog} className="dialog-content">
        <p {...attr.title} className="dialog-title">
          {title}
        </p>

        {typeof dialog === 'function'
          ? dialog({ close: attr.closeButton.onClick })
          : dialog}

        <button {...attr.closeButton} className="dialog-close">
          Close dialog
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button type="button" onClick={() => instance.show()}>
        Open dialog
      </button>
      {dialogPortal}
    </>
  );
}
