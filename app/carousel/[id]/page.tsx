import { notFound } from "next/navigation";
import { getCarousel } from "@/src/core/carousel/store";
import CarouselEditor from "./CarouselEditor";

export const dynamic = "force-dynamic";

export default async function CarouselPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getCarousel(id)) notFound();
  return <CarouselEditor id={id} />;
}
