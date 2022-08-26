import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfo } from '@fortawesome/free-solid-svg-icons';
import './Tooltip.scss';

interface TooltipProps {
  children: React.ReactNode;
}

export default function Tooltip({ children }: TooltipProps) {
  return children ? (
    <span className="tooltip">
      <FontAwesomeIcon icon={faInfo} className="tooltip-icon"></FontAwesomeIcon>
      <div className="tooltip-content card">{children}</div>
    </span>
  ) : null;
}
