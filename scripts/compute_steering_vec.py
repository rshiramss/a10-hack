from src.db import get_or_create_db, list_rollouts
from src.patch import compute_steering_vector
from src.probe import ProbeScorer
from src.service import rollout_result_from_db


if __name__ == "__main__":
    conn = get_or_create_db()
    records = list_rollouts(conn, limit=10000)
    results = [result for record in records if (result := rollout_result_from_db(record)) is not None]
    scorer = ProbeScorer.from_disk()
    vector = compute_steering_vector(results, scorer.peak_layer)
    print({"peak_layer": scorer.peak_layer, "vector_shape": vector.shape})
