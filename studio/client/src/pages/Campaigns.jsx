import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BRANDS } from "@shared/catalog.js";
import { formatDuration } from "@shared/model.js";
import { api } from "../api.js";

export function Campaigns() {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/campaigns")
      .then((data) => setCampaigns(data.campaigns))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Campaigns</p>
          <h1>Draft, ready, or running.</h1>
        </div>
        <Link to="/campaigns/new" className="button solid">New campaign</Link>
      </div>
      {error ? <p className="banner bad">{error}</p> : null}
      {campaigns && campaigns.length === 0 ? (
        <div className="empty">
          <h2>No campaigns yet.</h2>
          <p>Start with the business, the offer, and who it is for. The studio will write the scenes and export the film.</p>
          <Link to="/campaigns/new" className="button solid">Start a campaign</Link>
        </div>
      ) : null}
      <ul className="cards">
        {(campaigns || []).map((campaign) => (
          <li key={campaign.id}>
            <Link to={`/campaigns/${campaign.id}`}>
              <div className="card-top">
                <Status status={campaign.status} />
                <span>{formatDuration(campaign.durationSec)}</span>
              </div>
              <h2>{campaign.businessName}</h2>
              <p>{campaign.offer}</p>
              <small>{BRANDS[campaign.brandId]?.label}</small>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function Status({ status }) {
  return <span className={`status ${status}`}>{status}</span>;
}
