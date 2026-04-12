import { createBrowserRouter } from "react-router";
import { IDELayout } from "./components/IDELayout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: IDELayout,
  },
]);
