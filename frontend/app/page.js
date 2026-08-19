"use client";

import { AppProvider, useApp } from "@/lib/AppContext";
import TopBar from "@/components/TopBar";
import ExpBar from "@/components/ExpBar";
import BottomNav from "@/components/BottomNav";
import Toasts from "@/components/Toasts";
import HomeScreen from "@/components/screens/HomeScreen";
import RecordScreen from "@/components/screens/RecordScreen";
import TroubleScreen from "@/components/screens/TroubleScreen";
import AnalysisScreen from "@/components/screens/AnalysisScreen";
import VanityScreen from "@/components/screens/VanityScreen";
import MyScreen from "@/components/screens/MyScreen";
import ProfileModal from "@/components/modals/ProfileModal";
import ProductModal from "@/components/modals/ProductModal";
import AnalysisModal from "@/components/modals/AnalysisModal";
import MiscModal from "@/components/modals/MiscModal";

function Shell() {
  const { screen } = useApp();
  const showNav = screen !== "trouble";
  return (
    <>
      <div className="app">
        <TopBar />
        <ExpBar />
        {screen === "home" && <HomeScreen />}
        {screen === "record" && <RecordScreen />}
        {screen === "trouble" && <TroubleScreen />}
        {screen === "analysis" && <AnalysisScreen />}
        {screen === "vanity" && <VanityScreen />}
        {screen === "my" && <MyScreen />}
        {showNav && <BottomNav />}
      </div>
      <ProfileModal />
      <ProductModal />
      <AnalysisModal />
      <MiscModal />
      <Toasts />
    </>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
