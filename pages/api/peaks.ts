// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
//@ts-ignore
import slayer from "slayer";

type Data = {
  result: any;
  count: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const array: string = req.query.array as string;
  const convertedArray = array
    ? array.split(",").map((item) => parseInt(item))
    : [];

  const spikes = await slayer({
    minPeakDistance: 1.75,
  }).fromArray(convertedArray);

  // console.log(spikes.length);

  res.status(200).json({ result: spikes, count: spikes.length });
}
