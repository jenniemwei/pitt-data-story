import { DevLabNav } from "./DevLabNav";
import "./dev-lab.css";

export default function DevLabLayout({ children }) {
  return (
    <>
      <DevLabNav />
      <div className="dev-lab-main">{children}</div>
    </>
  );
}
