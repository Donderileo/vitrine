import Link from "next/link";
import { listCarousels } from "@/src/core/carousel/store";
import NewCarousel from "./NewCarousel";

export const dynamic = "force-dynamic";

export default function CarouselHome() {
  const list = listCarousels();
  return (
    <div className="grid">
      <div className="card">
        <h2>Novo carrossel</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Lista de produtos (Shopee) em slides: capa, um produto por slide com nome e preço, e a chamada final. Importe o CSV do afiliado e suba uma foto por produto.
        </p>
        <NewCarousel />
      </div>
      <div className="card">
        <h2>Carrosséis</h2>
        {list.length === 0 && <p className="muted">Nenhum carrossel ainda.</p>}
        <div className="list">
          {list.map((c) => (
            <Link key={c.id} href={`/carousel/${c.id}`} className="item">
              <div>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <small>{c.products.length} produto(s) · {c.slides.length ? `${c.slides.length} slides` : "sem slides"} · {new Date(c.updatedAt).toLocaleString("pt-BR")}</small>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
